export interface Project {
  _id: string;
  name: string;
  description: string;
  userId: string;
  imageUrl?: string;
  emissions?: {
    gwp: number;
    ubp: number;
    penre: number;
    lastCalculated: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}
