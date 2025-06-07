import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';
import AdmZip from 'adm-zip';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { OekobaudatMaterial } from '@/models';

const DATA_URL = process.env.OEKOBAUDAT_URL ||
  'https://www.oekobaudat.de/downloads/OEKOBAUDAT_2024_json.zip';

async function downloadFile(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download dataset: ${res.status} ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buffer);
}

async function importOekobaudat() {
  await connectToDatabase();
  const tmpZip = path.join('/tmp', 'oekobaudat.zip');
  await downloadFile(DATA_URL, tmpZip);

  const zip = new AdmZip(tmpZip);
  const entries = zip.getEntries();
  let count = 0;
  for (const entry of entries) {
    if (entry.entryName.toLowerCase().endsWith('.json')) {
      const content = entry.getData().toString('utf8');
      const json = JSON.parse(content);
      const material = {
        uuid: json.uuid || json.GUID || json.id,
        name: json.name || json.Name || json['Name_DE'],
        category: json.category || json['Category'],
        subCategory: json.subCategory || json['SubCategory'],
        gwp: json.GWP || json['GWP_GESAMT'],
        penrt: json.PENRT || json['PENRT_GESAMT'],
      };
      if (!material.uuid || !material.name) continue;
      await OekobaudatMaterial.updateOne(
        { uuid: material.uuid },
        { $set: material },
        { upsert: true }
      );
      count++;
    }
  }
  console.log(`Imported ${count} Oekobaudat records`);
  await mongoose.connection.close();
}

importOekobaudat().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
