import { ReplayEventLog, StepEvaluationRecord } from '../types/event.types';

export class TimeTravelReplayService {

  /** Retrieve state snapshot for a specific step index */
  public getStepRecord(eventLog: ReplayEventLog, stepIndex: number): StepEvaluationRecord | undefined {
    return eventLog.stepRecords.find((rec) => rec.stepIndex === stepIndex);
  }

  /** Replay and reconstruct payload up to target step index (0-indexed) */
  public replayUntilStep(
    eventLog: ReplayEventLog,
    targetStepIndex: number
  ): {
    currentPayload: Record<string, any>;
    activeStepRecord?: StepEvaluationRecord;
    completedSteps: number;
    totalSteps: number;
  } {
    const totalSteps = eventLog.stepRecords.length;
    const clampedStep = Math.max(0, Math.min(targetStepIndex, totalSteps - 1));
    const activeStepRecord = this.getStepRecord(eventLog, clampedStep);

    return {
      currentPayload: activeStepRecord ? { ...activeStepRecord.finalPayload } : {},
      activeStepRecord,
      completedSteps: clampedStep + 1,
      totalSteps,
    };
  }

  /** Calculate step forward index */
  public stepForward(currentStepIndex: number, totalSteps: number): number {
    return Math.min(currentStepIndex + 1, totalSteps - 1);
  }

  /** Calculate step backward index */
  public stepBackward(currentStepIndex: number): number {
    return Math.max(0, currentStepIndex - 1);
  }
}
