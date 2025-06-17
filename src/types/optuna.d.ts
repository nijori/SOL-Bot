/**
 * optuna ライブラリの型定義
 */

declare module 'optuna' {
  export interface Trial {
    suggest_int(name: string, low: number, high: number): number;
    suggest_float(name: string, low: number, high: number, step?: number): number;
    suggest_categorical(name: string, choices: any[]): any;
    report(value: number, step: number): void;
    should_prune(): boolean;
  }

  export interface StudyCreateOptions {
    direction?: 'minimize' | 'maximize';
    sampler?: any;
    pruner?: any;
    study_name?: string;
    storage?: string;
  }

  export class Study {
    static create(options?: StudyCreateOptions): Study;
    optimize(objective: (trial: Trial) => Promise<number> | number, options?: {
      n_trials?: number;
      timeout?: number;
      n_jobs?: number;
      catch?: (err: Error) => void;
    }): Promise<void>;
    best_params: Record<string, any>;
    best_value: number;
    trials: Array<{
      params: Record<string, any>;
      value?: number;
      state: string;
    }>;
  }

  export interface OptunaModule {
    create_study(options?: StudyCreateOptions): Study;
  }

  const optuna: OptunaModule;
  export default optuna;
} 