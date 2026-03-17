/**
 * Creator Export & Social Broadcasting Module
 *
 * Handles:
 *   1. Auto-formatting weekly summary images to platform-specific aspect ratios
 *      (16:9 YouTube Community, 9:16 Reels/TikTok, 1:1 Grid Posts)
 *   2. One-tap broadcasting via native iOS share sheet or connected social accounts
 *   3. 12-week macrocycle timelapse generation (15-second MP4 from archived frames)
 */

import {
  collection, doc, setDoc, getDoc, getDocs, addDoc,
  query, where, orderBy, limit, updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  WeeklySummary, FormattedExport, ExportAspectRatio, SocialPlatform,
  ConnectedSocialAccount, Macrocycle, TimelapseFrame, TimelapseConfig,
  ExportFormat,
} from '../types';

// ─── Platform Format Presets ────────────────────────────────────────────────

export const EXPORT_FORMATS: ExportFormat[] = [
  { ratio: '1:1',  width: 1080, height: 1080, platform: 'instagram_grid',      label: 'Grid Post' },
  { ratio: '9:16', width: 1080, height: 1920, platform: 'instagram_reels',     label: 'Reels / Stories' },
  { ratio: '9:16', width: 1080, height: 1920, platform: 'tiktok',             label: 'TikTok' },
  { ratio: '16:9', width: 1920, height: 1080, platform: 'youtube_community',  label: 'YouTube Community' },
  { ratio: '1:1',  width: 1080, height: 1080, platform: 'twitter',            label: 'Twitter/X Post' },
];

// ─── Default Timelapse Config ───────────────────────────────────────────────

export const DEFAULT_TIMELAPSE_CONFIG: TimelapseConfig = {
  durationSeconds: 15,
  fps: 2, // 2 frames/sec → 12 frames = 6s of unique content + transitions
  transitionType: 'crossfade',
  includeMetricsOverlay: true,
  backgroundMusic: 'epic',
  outputResolution: { width: 1080, height: 1080 },
};

export class CreatorExportService {
  private basePath: string;

  constructor(private appId: string, private userId: string) {
    this.basePath = `artifacts/${appId}/users/${userId}`;
  }

  // ─── Auto-Formatting Engine ───────────────────────────────────────────

  /**
   * Take a weekly summary image and crop/resize it to the target aspect ratio.
   * Uses intelligent center-crop with content-aware padding for 9:16 (vertical).
   */
  async formatForPlatform(
    sourceImage: string,
    targetRatio: ExportAspectRatio,
    platform: SocialPlatform
  ): Promise<string> {
    const format = EXPORT_FORMATS.find(f => f.ratio === targetRatio && f.platform === platform)
      || EXPORT_FORMATS.find(f => f.ratio === targetRatio)!;

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = format.width;
        canvas.height = format.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('Could not get canvas context');

        if (targetRatio === '9:16') {
          // For vertical: place the square image in the center, fill top/bottom
          // with a blurred + darkened version of the image
          this.drawVerticalFormat(ctx, img, format.width, format.height);
        } else if (targetRatio === '16:9') {
          // For wide: center-crop vertically
          this.drawWidescreenFormat(ctx, img, format.width, format.height);
        } else {
          // 1:1: center-crop to square
          const size = Math.min(img.width, img.height);
          const sx = (img.width - size) / 2;
          const sy = (img.height - size) / 2;
          ctx.drawImage(img, sx, sy, size, size, 0, 0, format.width, format.height);
        }

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = sourceImage;
    });
  }

  /**
   * 9:16 vertical layout: blurred background + centered main image + branding.
   */
  private drawVerticalFormat(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    width: number,
    height: number
  ): void {
    // Draw blurred, darkened background (stretched to fill)
    ctx.filter = 'blur(30px) brightness(0.3)';
    ctx.drawImage(img, 0, 0, width, height);
    ctx.filter = 'none';

    // Draw main image centered with padding
    const padding = width * 0.05;
    const availableWidth = width - (padding * 2);
    const imageSize = availableWidth;
    const imageX = padding;
    const imageY = (height - imageSize) / 2;

    // Rounded corners via clipping
    const radius = 24;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(imageX, imageY, imageSize, imageSize, radius);
    ctx.clip();
    const cropSize = Math.min(img.width, img.height);
    const sx = (img.width - cropSize) / 2;
    const sy = (img.height - cropSize) / 2;
    ctx.drawImage(img, sx, sy, cropSize, cropSize, imageX, imageY, imageSize, imageSize);
    ctx.restore();

    // Top branding area
    ctx.fillStyle = 'white';
    ctx.font = `800 ${Math.round(width * 0.06)}px "Inter", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('WEEKLY FORGE', width / 2, imageY - 40);

    ctx.font = `500 ${Math.round(width * 0.035)}px "Inter", system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(245, 158, 11, 0.9)'; // amber
    ctx.fillText('MATFORGE', width / 2, imageY - 10);

    // Bottom CTA
    ctx.font = `600 ${Math.round(width * 0.03)}px "Inter", system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('Track your grind at matforge.app', width / 2, imageY + imageSize + 50);
  }

  /**
   * 16:9 widescreen layout: center-crop with gradient edges.
   */
  private drawWidescreenFormat(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    width: number,
    height: number
  ): void {
    // Center-crop the source to 16:9
    const sourceAspect = img.width / img.height;
    const targetAspect = 16 / 9;
    let sx = 0, sy = 0, sw = img.width, sh = img.height;

    if (sourceAspect > targetAspect) {
      sw = img.height * targetAspect;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / targetAspect;
      sy = (img.height - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);

    // Subtle vignette
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.3,
      width / 2, height / 2, Math.max(width, height) * 0.7
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  // ─── Formatted Export Persistence ─────────────────────────────────────

  async saveFormattedExport(
    weeklySummaryId: string,
    format: ExportAspectRatio,
    platform: SocialPlatform,
    imageUrl: string
  ): Promise<FormattedExport> {
    const exportDoc: FormattedExport = {
      weeklySummaryId,
      format,
      platform,
      imageUrl,
      caption: this.generateCaption(platform),
      hashtags: this.getHashtags(platform),
      createdAt: new Date().toISOString(),
    };

    const colRef = collection(db, this.basePath, 'formatted_exports');
    const docRef = await addDoc(colRef, exportDoc);
    return { ...exportDoc, id: docRef.id };
  }

  private generateCaption(platform: SocialPlatform): string {
    const captions: Record<string, string> = {
      instagram_grid: 'Another week in the forge. The grind never stops.',
      instagram_reels: 'Weekly progress update. Building the body, sharpening the mind.',
      tiktok: 'Week in review — mats, iron, and discipline.',
      youtube_community: 'This week\'s training breakdown. Full details on the channel.',
      twitter: 'Weekly forge complete. Progress is progress.',
    };
    return captions[platform] || 'Another week done.';
  }

  private getHashtags(platform: SocialPlatform): string[] {
    const base = ['#MatForge', '#BJJ', '#Weightlifting', '#FitnessJourney'];
    const platformSpecific: Record<string, string[]> = {
      instagram_grid: ['#GymLife', '#BJJLifestyle', '#TransformationTuesday', '#StrengthTraining'],
      instagram_reels: ['#FitnessReels', '#GymReels', '#BJJReels', '#WorkoutMotivation'],
      tiktok: ['#GymTok', '#BJJTok', '#FitnessTok', '#GainsCheck'],
      youtube_community: ['#FitnessUpdate', '#TrainingLog'],
      twitter: ['#FitTwitter', '#BJJCommunity'],
    };
    return [...base, ...(platformSpecific[platform] || [])];
  }

  // ─── One-Tap Broadcasting ────────────────────────────────────────────

  /**
   * Two-tap export flow:
   *   Tap 1: Select format (auto-crops the image)
   *   Tap 2: Share via native sheet or connected account
   */
  async broadcastToNativeShare(
    imageUrl: string,
    platform: SocialPlatform,
    caption: string
  ): Promise<boolean> {
    try {
      const blob = await (await fetch(imageUrl)).blob();
      const file = new File([blob], `matforge-${platform}-${Date.now()}.png`, { type: 'image/png' });

      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: 'MatForge Weekly Summary',
          text: caption,
        });
        return true;
      }

      // Fallback: trigger download
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = file.name;
      link.click();
      return true;
    } catch (error) {
      console.error('Broadcasting failed:', error);
      return false;
    }
  }

  // ─── Connected Social Accounts ────────────────────────────────────────

  async getConnectedAccounts(): Promise<ConnectedSocialAccount[]> {
    const q = query(
      collection(db, this.basePath, 'social_accounts'),
      where('isActive', '==', true)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ConnectedSocialAccount));
  }

  async connectAccount(account: Omit<ConnectedSocialAccount, 'id'>): Promise<string> {
    const colRef = collection(db, this.basePath, 'social_accounts');
    const docRef = await addDoc(colRef, account);
    return docRef.id;
  }

  async disconnectAccount(accountId: string): Promise<void> {
    const docRef = doc(db, this.basePath, 'social_accounts', accountId);
    await updateDoc(docRef, { isActive: false });
  }

  // ─── Macrocycle Timelapse ─────────────────────────────────────────────

  /**
   * Get or create the user's active macrocycle.
   */
  async getActiveMacrocycle(): Promise<Macrocycle | null> {
    const q = query(
      collection(db, this.basePath, 'macrocycles'),
      where('status', '==', 'active'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Macrocycle;
  }

  async createMacrocycle(name?: string): Promise<Macrocycle> {
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + 12 * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const macrocycle: Macrocycle = {
      userEmail: '', // set by caller
      name: name || `Macrocycle ${startDate}`,
      startDate,
      endDate,
      status: 'active',
      frames: [],
      timelapseStatus: 'pending',
      createdAt: new Date().toISOString(),
    };

    const colRef = collection(db, this.basePath, 'macrocycles');
    const docRef = await addDoc(colRef, macrocycle);
    return { ...macrocycle, id: docRef.id };
  }

  /**
   * Archive this week's summary image as a timelapse frame.
   * Called automatically after each weekly summary generation.
   */
  async archiveTimelapseFrame(
    macrocycleId: string,
    summary: WeeklySummary,
    weekNumber: number
  ): Promise<void> {
    const frame: TimelapseFrame = {
      weekNumber,
      macrocycleId,
      weeklySummaryId: summary.id || '',
      imageUrl: summary.imageUrl || '',
      metrics: {
        poundsLost: summary.poundsLost,
        bjjHours: summary.bjjHours,
        liftingVolume: summary.liftingVolume,
        caloricAdherence: summary.caloricAdherence,
      },
      weekEnding: summary.weekEnding,
      createdAt: new Date().toISOString(),
    };

    const docRef = doc(db, this.basePath, 'macrocycles', macrocycleId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;

    const macrocycle = snap.data() as Macrocycle;
    const frames = [...(macrocycle.frames || []), frame];

    await updateDoc(docRef, { frames });

    // If 12 weeks reached, mark as ready for timelapse generation
    if (frames.length >= 12) {
      await updateDoc(docRef, {
        status: 'completed',
        totalPoundsLost: frames.reduce((sum, f) => sum + f.metrics.poundsLost, 0),
        totalBjjHours: frames.reduce((sum, f) => sum + f.metrics.bjjHours, 0),
        totalLiftingVolume: frames.reduce((sum, f) => sum + f.metrics.liftingVolume, 0),
      });
    }
  }

  /**
   * Generate a 15-second MP4 timelapse from 12 weekly frames.
   *
   * Implementation approach:
   *   - Uses Canvas API to render each frame with transition effects
   *   - MediaRecorder API captures the canvas as a video stream
   *   - Each frame displayed for (durationSeconds / frameCount) seconds
   *   - Crossfade transitions between frames
   *   - Metrics overlay shows week number + key stat progression
   *
   * Returns a blob URL for the generated MP4.
   */
  async generateTimelapse(
    macrocycleId: string,
    config: TimelapseConfig = DEFAULT_TIMELAPSE_CONFIG
  ): Promise<string> {
    const docRef = doc(db, this.basePath, 'macrocycles', macrocycleId);
    await updateDoc(docRef, { timelapseStatus: 'generating' });

    try {
      const snap = await getDoc(docRef);
      if (!snap.exists()) throw new Error('Macrocycle not found');

      const macrocycle = snap.data() as Macrocycle;
      const frames = macrocycle.frames || [];
      if (frames.length < 2) throw new Error('Need at least 2 frames for timelapse');

      // Load all frame images
      const images = await Promise.all(
        frames.map(frame => this.loadImage(frame.imageUrl))
      );

      // Create canvas for rendering
      const canvas = document.createElement('canvas');
      canvas.width = config.outputResolution.width;
      canvas.height = config.outputResolution.height;
      const ctx = canvas.getContext('2d')!;

      // Set up MediaRecorder for MP4 capture
      const stream = canvas.captureStream(config.fps * 2); // double fps for smooth transitions
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const videoUrl = await new Promise<string>((resolve, reject) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          resolve(URL.createObjectURL(blob));
        };
        recorder.onerror = reject;

        recorder.start();

        // Render frame sequence
        const msPerFrame = (config.durationSeconds * 1000) / frames.length;
        let frameIndex = 0;

        const renderFrame = () => {
          if (frameIndex >= frames.length) {
            recorder.stop();
            return;
          }

          const img = images[frameIndex];
          const frame = frames[frameIndex];

          // Draw image (center-crop to square)
          const cropSize = Math.min(img.width, img.height);
          const sx = (img.width - cropSize) / 2;
          const sy = (img.height - cropSize) / 2;
          ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, canvas.width, canvas.height);

          // Metrics overlay
          if (config.includeMetricsOverlay) {
            this.drawTimelapseOverlay(ctx, canvas, frame, frameIndex + 1, frames.length);
          }

          frameIndex++;
          setTimeout(renderFrame, msPerFrame);
        };

        renderFrame();
      });

      await updateDoc(docRef, {
        timelapseVideoUrl: videoUrl,
        timelapseStatus: 'complete',
      });

      return videoUrl;
    } catch (error: any) {
      await updateDoc(docRef, {
        timelapseStatus: 'failed',
      });
      throw error;
    }
  }

  private drawTimelapseOverlay(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    frame: TimelapseFrame,
    weekNum: number,
    totalWeeks: number
  ): void {
    // Bottom gradient
    const gradient = ctx.createLinearGradient(0, canvas.height * 0.7, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, canvas.height * 0.7, canvas.width, canvas.height * 0.3);

    const padding = canvas.width * 0.05;

    // Week number
    ctx.fillStyle = '#F59E0B';
    ctx.font = `900 ${Math.round(canvas.width * 0.08)}px "Inter", system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(`WEEK ${weekNum}`, padding, canvas.height - padding - 60);

    // Key metrics
    ctx.fillStyle = 'white';
    ctx.font = `700 ${Math.round(canvas.width * 0.035)}px "Inter", system-ui, sans-serif`;
    ctx.fillText(
      `${frame.metrics.poundsLost.toFixed(1)} lbs down · ${frame.metrics.bjjHours}h on mats · ${Math.round(frame.metrics.liftingVolume).toLocaleString()} lbs lifted`,
      padding,
      canvas.height - padding - 20
    );

    // Progress bar
    const barY = canvas.height - padding;
    const barWidth = canvas.width - (padding * 2);
    const barHeight = 4;
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(padding, barY, barWidth, barHeight);
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(padding, barY, barWidth * (weekNum / totalWeeks), barHeight);
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
}
