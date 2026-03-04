"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Cohort = { id: string; name: string; description: string | null };
type Mapping = {
  id: string;
  cohort_id: string;
  google_course_id: string;
  course_name: string | null;
  is_active: boolean;
};
type SyncState = {
  id: string;
  gc_course_mapping_id: string;
  sync_status: "idle" | "syncing" | "error" | "completed";
  last_synced_at: string | null;
  last_error: string | null;
  items_synced: number;
};
type Course = {
  id: string;
  name: string;
  section: string | null;
  descriptionHeading: string | null;
  courseState: string;
  alternateLink: string;
};

type Props = {
  connectionId: string | null;
  isConnectionValid: boolean;
  cohorts: Cohort[];
  existingMappings: Mapping[];
  syncStates: SyncState[];
};

// ─── Sync status badge ────────────────────────────────────────────────────────

function SyncBadge({ status }: { status: SyncState["sync_status"] }) {
  const styles: Record<string, string> = {
    idle: "bg-gray-100 text-gray-600",
    syncing: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-800",
    error: "bg-red-100 text-red-700",
  };
  const labels: Record<string, string> = {
    idle: "Never synced",
    syncing: "Syncing…",
    completed: "Synced",
    error: "Sync error",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.idle}`}>
      {labels[status] ?? status}
    </span>
  );
}

function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GoogleCoursesSection({
  connectionId,
  isConnectionValid,
  cohorts,
  existingMappings,
  syncStates,
}: Props) {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mapping form state
  const [mappingCourseId, setMappingCourseId] = useState<string | null>(null);
  const [selectedCohortId, setSelectedCohortId] = useState("");
  const [isCreatingCohort, setIsCreatingCohort] = useState(false);
  const [newCohortName, setNewCohortName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Sync state — track which mappingId is currently syncing
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!connectionId || !isConnectionValid) return;
    setLoading(true);
    setError(null);
    fetch("/api/google/courses")
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to fetch courses");
        }
        return res.json();
      })
      .then((data) => setCourses(data.courses || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [connectionId, isConnectionValid]);

  if (!connectionId || !isConnectionValid) return null;

  const mappedCourseIds = new Set(existingMappings.map((m) => m.google_course_id));
  const mappedCohortIds = new Set(existingMappings.map((m) => m.cohort_id));
  const mapped = courses.filter((c) => mappedCourseIds.has(c.id));
  const unmapped = courses.filter((c) => !mappedCourseIds.has(c.id));
  const availableCohorts = cohorts.filter((c) => !mappedCohortIds.has(c.id));

  const syncStateByMappingId = new Map(syncStates.map((s) => [s.gc_course_mapping_id, s]));

  const getMappingForCourse = (googleCourseId: string) =>
    existingMappings.find((m) => m.google_course_id === googleCourseId);

  const getCohortName = (googleCourseId: string) => {
    const mapping = getMappingForCourse(googleCourseId);
    if (!mapping) return null;
    return cohorts.find((c) => c.id === mapping.cohort_id)?.name ?? mapping.course_name;
  };

  const openMappingForm = (courseId: string) => {
    setMappingCourseId(courseId);
    setSelectedCohortId("");
    setIsCreatingCohort(false);
    setNewCohortName("");
    setMapError(null);
  };

  const handleMap = async (course: Course) => {
    setSubmitting(true);
    setMapError(null);
    try {
      let cohortId = selectedCohortId;
      if (isCreatingCohort) {
        if (!newCohortName.trim()) {
          setMapError("Cohort name is required");
          setSubmitting(false);
          return;
        }
        const res = await fetch("/api/cohorts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newCohortName.trim() }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create cohort");
        }
        cohortId = (await res.json()).cohort.id;
      }
      if (!cohortId) {
        setMapError("Select a cohort or create a new one");
        setSubmitting(false);
        return;
      }
      const res = await fetch("/api/google/courses/map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohortId,
          googleCourseId: course.id,
          courseName: course.name,
          gcConnectionId: connectionId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create mapping");
      }
      setMappingCourseId(null);
      router.refresh();
    } catch (err: unknown) {
      setMapError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSync = async (mappingId: string) => {
    setSyncingId(mappingId);
    setSyncError((prev) => ({ ...prev, [mappingId]: "" }));
    try {
      const res = await fetch("/api/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappingId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Sync failed");
      }
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      setSyncError((prev) => ({ ...prev, [mappingId]: msg }));
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium">Google Classroom Courses</h2>

      {loading && <p className="text-sm text-gray-500">Loading courses…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && courses.length === 0 && (
        <p className="text-sm text-gray-500">No active courses found in Google Classroom.</p>
      )}

      {/* ── Mapped courses ────────────────────────────────────────────────── */}
      {mapped.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-600">Mapped courses</h3>
          {mapped.map((course) => {
            const mapping = getMappingForCourse(course.id);
            const syncState = mapping ? syncStateByMappingId.get(mapping.id) : undefined;
            const isSyncing = syncingId === mapping?.id;

            return (
              <div key={course.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{course.name}</p>
                    {course.section && (
                      <p className="text-sm text-gray-500">{course.section}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      Cohort: {getCohortName(course.id)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {syncState && <SyncBadge status={isSyncing ? "syncing" : syncState.sync_status} />}
                    {mapping && (
                      <button
                        className="border rounded px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
                        onClick={() => handleSync(mapping.id)}
                        disabled={isSyncing || syncingId !== null}
                      >
                        {isSyncing ? "Syncing…" : "Sync Now"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Sync metadata */}
                {syncState && !isSyncing && (
                  <div className="text-xs text-gray-400 flex flex-wrap gap-3">
                    {syncState.last_synced_at && (
                      <span>Last synced {formatRelative(syncState.last_synced_at)}</span>
                    )}
                    {syncState.sync_status === "completed" && syncState.items_synced > 0 && (
                      <span>{syncState.items_synced} items synced</span>
                    )}
                    {syncState.sync_status === "error" && syncState.last_error && (
                      <span className="text-red-500">{syncState.last_error}</span>
                    )}
                  </div>
                )}

                {/* Client-side sync error */}
                {syncError[mapping?.id ?? ""] && (
                  <p className="text-xs text-red-600">{syncError[mapping!.id]}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Unmapped courses ──────────────────────────────────────────────── */}
      {unmapped.length > 0 && (
        <div className="space-y-2">
          {mapped.length > 0 && (
            <h3 className="text-sm font-medium text-gray-600">Unmapped courses</h3>
          )}
          {unmapped.map((course) => (
            <div key={course.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{course.name}</p>
                  {course.section && (
                    <p className="text-sm text-gray-500">{course.section}</p>
                  )}
                </div>
                {mappingCourseId !== course.id && (
                  <button
                    className="border rounded px-3 py-1 text-sm hover:bg-gray-50"
                    onClick={() => openMappingForm(course.id)}
                  >
                    Map to Cohort
                  </button>
                )}
              </div>

              {mappingCourseId === course.id && (
                <div className="border-t pt-3 space-y-3">
                  {!isCreatingCohort && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Select a cohort</label>
                      <select
                        className="w-full border rounded p-2 text-sm"
                        value={selectedCohortId}
                        onChange={(e) => setSelectedCohortId(e.target.value)}
                      >
                        <option value="">Choose a cohort…</option>
                        {availableCohorts.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <button
                        className="text-sm text-blue-600 hover:underline"
                        onClick={() => { setIsCreatingCohort(true); setSelectedCohortId(""); }}
                      >
                        or create a new cohort
                      </button>
                    </div>
                  )}

                  {isCreatingCohort && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">New cohort name</label>
                      <input
                        className="w-full border rounded p-2 text-sm"
                        placeholder="e.g. Fall 2026 Biology"
                        value={newCohortName}
                        onChange={(e) => setNewCohortName(e.target.value)}
                      />
                      <button
                        className="text-sm text-blue-600 hover:underline"
                        onClick={() => { setIsCreatingCohort(false); setNewCohortName(""); }}
                      >
                        or select an existing cohort
                      </button>
                    </div>
                  )}

                  {mapError && <p className="text-sm text-red-600">{mapError}</p>}

                  <div className="flex gap-2">
                    <button
                      className="border rounded px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-50"
                      onClick={() => handleMap(course)}
                      disabled={submitting}
                    >
                      {submitting ? "Saving…" : "Save Mapping"}
                    </button>
                    <button
                      className="border rounded px-3 py-1 text-sm text-gray-500 hover:bg-gray-50"
                      onClick={() => setMappingCourseId(null)}
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
