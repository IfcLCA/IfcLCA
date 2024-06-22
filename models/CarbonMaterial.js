const mongoose = require("mongoose");

// Adjusted schema for carbon materials to include more fields
const carbonMaterialSchema = new mongoose.Schema(
  {
    "ID-Nummer": String,
    "UUID-Nummer": String,
    BAUMATERIALIEN: {
      type: String,
      required: true,
    },
    "ID-Nummer Entsorgung": String,
    Entsorgung: String,
    "Rohdichte/Flächenmasse": String, // Kept as String if it includes non-numeric values like "-"
    Bezug: String,
    // converting numeric strings to numbers where appropriate
    "UBP'21, Total,  (in UBP)": Number,
    "Primärenergie gesamt, Total,  (in kWh oil-eq)": Number,
    "Treibhausgasemissionen, Total,  (in kg CO2-eq)": Number,
    "Biogener Kohlenstoff (im Produkt enthalten: kg C)": Number,
    groupNumber: String,
    groupName: String,
  },
  {
    timestamps: true,
  }
);

// Create the model from the schema
const CarbonMaterial = mongoose.model(
  "Carbon_data",
  carbonMaterialSchema,
  "carbon_data_KBOB"
);

module.exports = CarbonMaterial;
