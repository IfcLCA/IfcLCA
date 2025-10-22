export interface Project {
  id: string;
  calculationArea?: {
    type: string;
    value: number;
    unit: string;
  };
  classificationSystem?: string;
  elements?: {
    materials: {
      volume?: number;
      material?: {
        density?: number;
        kbobMatchId?: {
          GWP?: number;
          UBP?: number;
          PENRE?: number;
        };
      };
    }[];
    classification?: {
      system: string;
      code: string;
      name?: string;
    };
  }[];
}
