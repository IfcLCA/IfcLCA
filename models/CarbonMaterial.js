const mongoose = require("mongoose");

// Adjusted schema for carbon materials to include more fields
const carbonMaterialSchema = new mongoose.Schema(
  {
    "ID-Nummer [KBOB / ecobau / IPB  2009/1:2022, Version 5]": String,
    "UUID-Nummer": String,
    BAUMATERIALIEN: {
      type: String,
      required: true,
    },
    "ID-Nummer Entsorgung": String,
    Entsorgung: String,
    "Rohdichte/ Flächenmasse": String, // Kept as String if it includes non-numeric values like "-"
    Bezug: String,
    "UBP (Total)": Number,
    //    "UBP (Herstellung)": Number,
    //    "UBP (Entsorgung)": Number,
    "Primärenergie gesamt, Total [kWh oil-eq]": Number,
    //    "Primärenergie gesamt, Herstellung total [kWh oil-eq]": Number,
    //    "Primärenergie gesamt, Herstellung energetisch genutzt [kWh oil-eq]": Number,
    //    "Primärenergie gesamt, Herstellung stofflich genutzt [kWh oil-eq]": Number,
    //    "Primärenergie gesamt, Entsorgung [kWh oil-eq]": Number,
    //    "Primärenergie erneuerbar, Total [kWh oil-eq]": Number,
    //    "Primärenergie erneuerbar, Herstellung total [kWh oil-eq]": Number,
    //    "Primärenergie erneuerbar, Herstellung energetisch genutzt [kWh oil-eq]": Number,
    //    "Primärenergie erneuerbar, Herstellung stofflich genutzt [kWh oil-eq]": Number,
    //    "Primärenergie erneuerbar, Entsorgung [kWh oil-eq]": Number,
    "Primärenergie nicht erneuerbar, Total [kWh oil-eq]": Number,
    //    "Primärenergie nicht erneuerbar, Herstellung total [kWh oil-eq]": Number,
    //    "Primärenergie nicht erneuerbar, Herstellung energetisch genutzt [kWh oil-eq]": Number,
    //    "Primärenergie nicht erneuerbar, Herstellung stofflich genutzt [kWh oil-eq]": Number,
    //    "Primärenergie nicht erneuerbar, Entsorgung [kWh oil-eq]": Number,
    "Treibhausgasemissionen, Total [kg CO2-eq]": Number,
    //    "Treibhausgasemissionen, Herstellung [kg CO2-eq]": Number,
    //    "Treibhausgasemissionen, Entsorgung [kg CO2-eq]": Number,
    //    "Biogener Kohlenstoff, im Produkt enthalten [kg C]": Number,
    //    "MATÉRIAUX DE CONSTRUCTON": String,
    //    "Élimination": String,
    groupName: {
      type: String,
      set: function (value) {
        return this["[group]"] || value;
      },
    },
  },
  {
    timestamps: true,
  }
);

// Create the model from the schema
const CarbonMaterial = mongoose.model(
  "Carbon_data",
  carbonMaterialSchema,
  "KBOB_v5_0"
);

module.exports = CarbonMaterial;
