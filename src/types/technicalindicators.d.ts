declare module 'technicalindicators' {
  interface InputEMA {
    period: number;
    values: number[];
  }

  interface InputATR {
    high: number[];
    low: number[];
    close: number[];
    period: number;
  }

  interface InputADX {
    high: number[];
    low: number[];
    close: number[];
    period: number;
  }

  interface ADXOutput {
    adx: number;
    pdi: number;
    mdi: number;
  }

  interface InputHighestLowest {
    period: number;
    values: number[];
  }

  export class EMA {
    static calculate(input: InputEMA): number[];
  }

  export class ATR {
    static calculate(input: InputATR): number[];
  }

  export class ADX {
    static calculate(input: InputADX): ADXOutput[];
  }

  export class Highest {
    static calculate(input: InputHighestLowest): number[];
  }

  export class Lowest {
    static calculate(input: InputHighestLowest): number[];
  }
}
