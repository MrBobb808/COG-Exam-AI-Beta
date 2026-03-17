/**
 * Enhanced Weekly Summary Service — Nano Banana 2 Pipeline
 *
 * Automated Sunday 6PM pipeline:
 *   1. Aggregate weekly metrics (lbs lost, BJJ hours, lifting volume, caloric adherence)
 *   2. Classify mascot tier from metric thresholds → dynamic prompt generation
 *   3. Send prompt to Nano Banana 2 (Gemini 3 Flash Image) for Biblit mascot rendering
 *   4. Overlay hard data onto generated image using Canvas API
 *   5. Save to Firestore + archive as timelapse frame
 */

import { GoogleGenAI } from "@google/genai";
import {
  WorkoutLog, DailyStats, WeeklySummary, UserProfile,
  MascotTier, MascotMapping, SummaryPipelineRun, SummaryStyle,
  NanoBanana2Config, TimelapseFrame,
} from "../types";
import {
  collection, addDoc, doc, setDoc, getDoc, query, where, getDocs, orderBy, limit, updateDoc
} from "firebase/firestore";
import { db } from "../firebase";

// ─── Mascot Tier Mapping ────────────────────────────────────────────────────

const MASCOT_MAPPINGS: MascotMapping[] = [
  {
    tier: 'legendary',
    minPoundsLost: 3,
    minBjjHours: 7,
    minLiftingVolume: 15000,
    minCaloricAdherence: 90,
    description: 'Biblit in a gleaming BJJ gi with a purple belt, wearing a championship-grade leather lifting belt and golden wrist wraps, standing triumphantly atop a podium in a cinematic arena with spotlights and confetti',
    accessories: ['championship gi', 'purple belt', 'golden wrist wraps', 'lifting belt', 'medal'],
  },
  {
    tier: 'champion',
    minPoundsLost: 2,
    minBjjHours: 5,
    minLiftingVolume: 10000,
    minCaloricAdherence: 80,
    description: 'Biblit wearing a BJJ gi with a blue belt and a heavy leather lifting belt, looking victorious and powerful in a cinematic gym setting with dramatic lighting',
    accessories: ['BJJ gi', 'blue belt', 'lifting belt'],
  },
  {
    tier: 'warrior',
    minPoundsLost: 1,
    minBjjHours: 3,
    minLiftingVolume: 5000,
    minCaloricAdherence: 70,
    description: 'Biblit in training gear with a white gi and lifting gloves, mid-training in an intense gym environment with chalk dust in the air',
    accessories: ['white gi', 'lifting gloves', 'chalk'],
  },
  {
    tier: 'training',
    minPoundsLost: 0,
    minBjjHours: 1,
    minLiftingVolume: 1000,
    minCaloricAdherence: 50,
    description: 'Biblit in casual workout gear, sweating but smiling, holding a kettlebell in a well-lit modern gym',
    accessories: ['workout gear', 'kettlebell'],
  },
  {
    tier: 'base',
    minPoundsLost: 0,
    minBjjHours: 0,
    minLiftingVolume: 0,
    minCaloricAdherence: 0,
    description: 'Biblit looking motivated and ready to start, standing at the entrance of a gym with determination',
    accessories: ['gym bag'],
  },
];

// ─── Style Prompt Templates ─────────────────────────────────────────────────

const STYLE_PROMPTS: Record<SummaryStyle, string> = {
  '3d': '3D animated style, Pixar-like, vibrant colors, soft global illumination, subsurface scattering on skin, volumetric lighting',
  'comic': 'Gritty comic book style, bold ink lines, dramatic shadows, high contrast, halftone dots, dynamic action poses, Frank Miller influence',
  'photorealistic': 'Photorealistic style, cinematic lighting, 8k resolution, highly detailed textures, shallow depth of field, anamorphic lens flare',
};

export class WeeklySummaryService {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  // ─── Data Retrieval ───────────────────────────────────────────────────

  static async getLatestSummary(userEmail: string): Promise<WeeklySummary | null> {
    try {
      const q = query(
        collection(db, "weeklySummaries"),
        where("userEmail", "==", userEmail),
        orderBy("timestamp", "desc"),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as WeeklySummary;
    } catch (error) {
      console.error("Error fetching latest summary:", error);
      return null;
    }
  }

  static async getMacrocycleSummaries(userEmail: string): Promise<WeeklySummary[]> {
    try {
      const q = query(
        collection(db, "weeklySummaries"),
        where("userEmail", "==", userEmail),
        orderBy("timestamp", "asc"),
        limit(12)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WeeklySummary));
    } catch (error) {
      console.error("Error fetching macrocycle summaries:", error);
      return [];
    }
  }

  // ─── Step 1: Data Aggregation ─────────────────────────────────────────

  /**
   * Compile weekly metrics every Sunday at 6 PM.
   * Required variables: total pounds lost, BJJ hours, lifting volume, caloric adherence %.
   */
  static aggregateWeeklyMetrics(
    logs: WorkoutLog[],
    dailyStats: DailyStats[],
    profile: UserProfile | null
  ) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1. Pounds Lost — compare earliest weight in the window to latest
    const chronoStats = [...dailyStats]
      .filter(s => s.bodyWeight)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const currentWeight = chronoStats.length > 0 ? (chronoStats[chronoStats.length - 1].bodyWeight || 0) : 0;
    const weight7DaysAgo = chronoStats.find(s => new Date(s.timestamp) >= sevenDaysAgo)?.bodyWeight || currentWeight;
    const poundsLost = Math.max(0, weight7DaysAgo - currentWeight);

    // 2. BJJ Hours — each session defaults to 1.5h
    const bjjLogs = logs.filter(l => l.type === 'bjj' && new Date(l.date) >= sevenDaysAgo);
    const bjjHours = bjjLogs.length * 1.5;

    // 3. Total Lifting Volume (weight × reps across all sets)
    const strengthLogs = logs.filter(l => l.type === 'strength' && new Date(l.date) >= sevenDaysAgo);
    let liftingVolume = 0;
    strengthLogs.forEach(log => {
      log.sets?.forEach(set => {
        const w = parseFloat(set.weight) || 0;
        const r = parseFloat(set.reps) || 0;
        liftingVolume += w * r;
      });
    });

    // 4. Caloric Adherence — % of days where consumed ≤ target
    const weeklyStats = dailyStats.filter(s => new Date(s.date) >= sevenDaysAgo);
    const adherenceDays = weeklyStats.filter(s => {
      const burned = (s.baseCalories || 2000) + (s.caloriesBurned || 0);
      const consumed = s.caloriesConsumed || 0;
      return consumed > 0 && consumed <= burned;
    }).length;
    const caloricAdherence = weeklyStats.length > 0 ? (adherenceDays / weeklyStats.length) * 100 : 0;

    return {
      poundsLost,
      bjjHours,
      liftingVolume,
      caloricAdherence,
      weekEnding: now.toISOString().split('T')[0],
    };
  }

  // ─── Step 2: Mascot Tier Classification ───────────────────────────────

  /**
   * Map weekly metrics to a mascot tier. Checks from highest tier down.
   */
  static classifyMascotTier(metrics: {
    poundsLost: number;
    bjjHours: number;
    liftingVolume: number;
    caloricAdherence: number;
  }): { tier: MascotTier; mapping: MascotMapping } {
    for (const mapping of MASCOT_MAPPINGS) {
      if (
        metrics.poundsLost >= mapping.minPoundsLost &&
        metrics.bjjHours >= mapping.minBjjHours &&
        metrics.liftingVolume >= mapping.minLiftingVolume &&
        metrics.caloricAdherence >= mapping.minCaloricAdherence
      ) {
        return { tier: mapping.tier, mapping };
      }
    }
    return { tier: 'base', mapping: MASCOT_MAPPINGS[MASCOT_MAPPINGS.length - 1] };
  }

  // ─── Step 3: Dynamic Prompt Generation ────────────────────────────────

  /**
   * Build the prompt for Nano Banana 2, injecting the user's stats
   * and mapping their progression to Biblit's visual state.
   */
  static buildDynamicPrompt(
    metrics: { poundsLost: number; bjjHours: number; liftingVolume: number; caloricAdherence: number },
    mapping: MascotMapping,
    style: SummaryStyle,
    profile: UserProfile | null
  ): string {
    const beltDesc = profile?.bjjBelt ? ` with a ${profile.bjjBelt.toLowerCase()} belt` : '';
    const stylePrompt = STYLE_PROMPTS[style];

    // Override belt in description if profile has one
    let mascotDesc = mapping.description;
    if (profile?.bjjBelt && mapping.tier !== 'base' && mapping.tier !== 'training') {
      mascotDesc = mascotDesc.replace(/(?:white|blue|purple|brown|black) belt/i, `${profile.bjjBelt.toLowerCase()} belt`);
    }

    return [
      `A high-quality image of ${mascotDesc}.`,
      stylePrompt + '.',
      `The scene should feel inspiring and represent a week where the athlete lost ${metrics.poundsLost.toFixed(1)} lbs,`,
      `spent ${metrics.bjjHours} hours training Brazilian Jiu-Jitsu,`,
      `lifted ${Math.round(metrics.liftingVolume).toLocaleString()} lbs total volume,`,
      `and maintained ${Math.round(metrics.caloricAdherence)}% caloric adherence.`,
      'No text in the image. Focus on the character and environment.',
    ].join(' ');
  }

  // ─── Step 4: Image Generation via Nano Banana 2 ──────────────────────

  /**
   * Send the dynamic prompt to Nano Banana 2 (Gemini 3 Flash Image).
   */
  async generateSummaryImage(
    metrics: { poundsLost: number; bjjHours: number; liftingVolume: number; caloricAdherence: number },
    style: SummaryStyle,
    profile: UserProfile | null,
    config?: Partial<NanoBanana2Config>
  ): Promise<{ imageUrl: string; prompt: string; mascotTier: MascotTier; accessories: string[] }> {
    const { tier, mapping } = WeeklySummaryService.classifyMascotTier(metrics);
    const prompt = WeeklySummaryService.buildDynamicPrompt(metrics, mapping, style, profile);

    const modelName = config?.model || 'gemini-3.1-flash-image-preview';
    const aspectRatio = config?.aspectRatio || '1:1';
    const imageSize = config?.imageSize || '1K';

    const response = await this.ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio,
          imageSize,
        },
      },
    });

    let imageUrl = "";
    for (const part of response.candidates![0].content!.parts!) {
      if ((part as any).inlineData) {
        imageUrl = `data:image/png;base64,${(part as any).inlineData.data}`;
        break;
      }
    }

    if (!imageUrl) throw new Error("Nano Banana 2 failed to generate image");

    return { imageUrl, prompt, mascotTier: tier, accessories: mapping.accessories };
  }

  // ─── Step 5: Text-to-Image Overlay ────────────────────────────────────

  /**
   * Overlay hard weekly data onto the generated Biblit image.
   * Uses Canvas API with a bold, stylized UI font and gradient backdrop.
   */
  async overlayTextOnImage(
    base64Image: string,
    metrics: { poundsLost: number; bjjHours: number; liftingVolume: number; caloricAdherence: number }
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject("Could not get canvas context");

        // Draw background image
        ctx.drawImage(img, 0, 0);

        // Gradient overlay for readability
        const gradient = ctx.createLinearGradient(0, canvas.height * 0.65, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(0.3, 'rgba(0,0,0,0.4)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.85)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, canvas.height * 0.65, canvas.width, canvas.height * 0.35);

        // Text styling — bold condensed font
        ctx.fillStyle = 'white';
        ctx.textAlign = 'left';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 2;

        const padding = canvas.width * 0.05;
        const fontSize = Math.round(canvas.width * 0.04);
        const labelSize = Math.round(fontSize * 0.6);
        ctx.font = `900 ${fontSize}px "Inter", "SF Pro Display", system-ui, sans-serif`;

        const stats = [
          { value: `${metrics.poundsLost.toFixed(1)} lbs`, label: 'Down This Week' },
          { value: `${metrics.bjjHours}`, label: 'Hours on the Mats' },
          { value: `${Math.round(metrics.liftingVolume).toLocaleString()} lbs`, label: 'Total Volume Lifted' },
          { value: `${Math.round(metrics.caloricAdherence)}%`, label: 'Caloric Adherence' },
        ];

        const lineHeight = fontSize + labelSize + 12;
        const startY = canvas.height - padding - (stats.length * lineHeight);

        stats.forEach((stat, index) => {
          const y = startY + index * lineHeight;

          // Value (large, white, bold)
          ctx.font = `900 ${fontSize}px "Inter", "SF Pro Display", system-ui, sans-serif`;
          ctx.fillStyle = '#F59E0B'; // amber-500
          ctx.fillText(stat.value, padding, y);

          // Label (smaller, muted)
          ctx.font = `600 ${labelSize}px "Inter", "SF Pro Display", system-ui, sans-serif`;
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillText(stat.label, padding, y + labelSize + 4);
        });

        // MatForge watermark
        ctx.font = `800 ${Math.round(fontSize * 0.5)}px "Inter", system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.textAlign = 'right';
        ctx.fillText('MATFORGE', canvas.width - padding, canvas.height - padding);

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = base64Image;
    });
  }

  // ─── Image Format Cropping ────────────────────────────────────────────

  static async formatImage(
    base64Image: string,
    aspectRatio: '1:1' | '16:9' | '9:16'
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width, height;

        if (aspectRatio === '1:1') {
          width = height = Math.min(img.width, img.height);
        } else if (aspectRatio === '16:9') {
          width = img.width;
          height = (img.width * 9) / 16;
        } else {
          height = img.height;
          width = (img.height * 9) / 16;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject("Could not get canvas context");

        const offsetX = (img.width - width) / 2;
        const offsetY = (img.height - height) / 2;
        ctx.drawImage(img, offsetX, offsetY, width, height, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = base64Image;
    });
  }

  // ─── Pipeline Orchestration ───────────────────────────────────────────

  /**
   * Full pipeline run: aggregate → classify → generate → overlay → save.
   * Called by the scheduled Sunday 6PM trigger or manually by the user.
   */
  async runPipeline(
    userEmail: string,
    logs: WorkoutLog[],
    dailyStats: DailyStats[],
    profile: UserProfile | null,
    style: SummaryStyle,
    basePath: string
  ): Promise<{ summary: WeeklySummary; pipelineRun: SummaryPipelineRun }> {
    const runRef = doc(collection(db, basePath, 'pipeline_runs'));
    const pipelineRun: SummaryPipelineRun = {
      id: runRef.id,
      userEmail,
      scheduledFor: new Date().toISOString(),
      status: 'aggregating',
      style,
      startedAt: new Date().toISOString(),
      timestamp: new Date().toISOString(),
    };

    await setDoc(runRef, pipelineRun);

    try {
      // Step 1: Aggregate
      const metrics = WeeklySummaryService.aggregateWeeklyMetrics(logs, dailyStats, profile);
      pipelineRun.metrics = metrics;
      pipelineRun.status = 'generating';
      await updateDoc(runRef, { metrics, status: 'generating' });

      // Step 2 + 3: Classify tier + Generate image
      const { imageUrl: rawImage, prompt, mascotTier, accessories } =
        await this.generateSummaryImage(metrics, style, profile);
      pipelineRun.mascotTier = mascotTier;
      pipelineRun.generatedPrompt = prompt;
      pipelineRun.rawImageUrl = rawImage;
      pipelineRun.status = 'overlaying';
      await updateDoc(runRef, {
        mascotTier, generatedPrompt: prompt, rawImageUrl: rawImage, status: 'overlaying'
      });

      // Step 4: Overlay text
      const finalImage = await this.overlayTextOnImage(rawImage, metrics);
      pipelineRun.finalImageUrl = finalImage;
      pipelineRun.status = 'complete';
      pipelineRun.completedAt = new Date().toISOString();
      await updateDoc(runRef, {
        finalImageUrl: finalImage, status: 'complete', completedAt: pipelineRun.completedAt
      });

      // Step 5: Save summary
      const summary: WeeklySummary = {
        ...metrics,
        imageUrl: finalImage,
        prompt,
        style,
        mascotTier,
        mascotAccessories: accessories,
        generationModel: 'gemini-3.1-flash-image-preview',
        timestamp: new Date().toISOString(),
      };

      await WeeklySummaryService.saveSummary(userEmail, summary);

      return { summary, pipelineRun };
    } catch (error: any) {
      pipelineRun.status = 'failed';
      pipelineRun.errorMessage = error.message;
      await updateDoc(runRef, { status: 'failed', errorMessage: error.message });
      throw error;
    }
  }

  // ─── Persistence ──────────────────────────────────────────────────────

  static async saveSummary(userEmail: string, summary: WeeklySummary) {
    try {
      await addDoc(collection(db, "weeklySummaries"), {
        ...summary,
        userEmail,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error saving summary:", error);
    }
  }
}
