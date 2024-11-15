import { Types, Document } from "mongoose";

export interface ProjectDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  phase?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UploadDocument extends Document {
  _id: Types.ObjectId;
  filename: string;
  status: string;
  error?: string;
  elementCount: number;
  projectId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  deleted: boolean;
}

export interface ElementDocument extends Document {
  _id: Types.ObjectId;
  guid: string;
  name: string;
  type?: string;
  volume?: number;
  buildingStorey?: string;
  projectId: Types.ObjectId;
  uploadId?: Types.ObjectId;
  materials: Types.ObjectId[];
  materialLayers?: {
    layerSetName?: string;
    layers: Array<{
      materialName?: string;
      thickness?: number;
      layerId?: string;
      layerName?: string;
    }>;
  };
}

export interface MaterialDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  category?: string;
  volume?: number;
  fraction?: number;
}
