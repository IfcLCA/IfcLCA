export interface Project {
  id: string;
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
  }[];
}
