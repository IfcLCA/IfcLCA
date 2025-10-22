export interface EBKPWithAmortization {
  code: string;
  label: string;
  amortizationYears?: number[];
}

export interface EBKPStructuredWithAmortization {
  [hauptgruppe: string]: {
    [elementgruppe: string]: EBKPWithAmortization[];
  };
}

export type AmortizationYears = 20 | 30 | 40 | 60;

export const EBKP_STRUCTURE_WITH_AMORTIZATION = {
  "A": {
    "A01": [
      {
        "code": "A01.01",
        "label": "Grundstückserwerb"
      },
      {
        "code": "A01.02",
        "label": "Baurechtserwerb"
      },
      {
        "code": "A01.03",
        "label": "Bauwerkserwerb"
      },
      {
        "code": "A01.04",
        "label": "Perimeterbeitrag"
      }
    ],
    "A02": [
      {
        "code": "A02.01",
        "label": "Handänderungssteuer, Gewinnsteuer"
      },
      {
        "code": "A02.02",
        "label": "Notariatskosten"
      },
      {
        "code": "A02.03",
        "label": "Grundbuchgebühr"
      },
      {
        "code": "A02.04",
        "label": "Anwaltskosten, Gerichtskosten"
      },
      {
        "code": "A02.05",
        "label": "Vermittlungsprovision"
      },
      {
        "code": "A02.06",
        "label": "Abfindung, Servitut"
      },
      {
        "code": "A02.07",
        "label": "Vermessung, Vermarkung"
      }
    ]
  },
  "B": {
    "B01": [
      {
        "code": "B01.01",
        "label": "Baugrunduntersuchung"
      },
      {
        "code": "B01.02",
        "label": "Bestandsaufnahme"
      },
      {
        "code": "B01.03",
        "label": "Umweltmessung"
      },
      {
        "code": "B01.04",
        "label": "Überwachung"
      }
    ],
    "B02": [
      {
        "code": "B02.01",
        "label": "Baustellenerschliessung"
      },
      {
        "code": "B02.02",
        "label": "Versorgung, Entsorgung"
      },
      {
        "code": "B02.03",
        "label": "Arbeitsraum, Aufenthaltsraum"
      },
      {
        "code": "B02.04",
        "label": "Hebe-,  Verlade-,  Transport-,  Lagereinrichtung"
      },
      {
        "code": "B02.05",
        "label": "Einrichtung für Materialaufbereitung"
      },
      {
        "code": "B02.06",
        "label": "Witterungsbedingte Baumassnahme"
      },
      {
        "code": "B02.07",
        "label": "Baustellenorganisation, Sicherheit"
      },
      {
        "code": "B02.08",
        "label": "Schutzmassnahme für Umgebung"
      }
    ],
    "B03": [
      {
        "code": "B03.01",
        "label": "Provisorisches Rückhaltesystem"
      },
      {
        "code": "B03.02",
        "label": "Provisorische Werkleitung"
      },
      {
        "code": "B03.03",
        "label": "Provisorisches Gebäude"
      },
      {
        "code": "B03.04",
        "label": "Provisorische Verkehrsanlage"
      },
      {
        "code": "B03.05",
        "label": "Provisorische Ausstattung"
      }
    ],
    "B04": [
      {
        "code": "B04.01",
        "label": "Starkstromleitung"
      },
      {
        "code": "B04.02",
        "label": "Schwachstromleitung"
      },
      {
        "code": "B04.03",
        "label": "Fernwärmeleitung"
      },
      {
        "code": "B04.04",
        "label": "Fernkälteleitung"
      },
      {
        "code": "B04.05",
        "label": "Wasserleitung"
      },
      {
        "code": "B04.06",
        "label": "Schmutzwasserleitung"
      },
      {
        "code": "B04.07",
        "label": "Regenwasserleitung"
      },
      {
        "code": "B04.08",
        "label": "Gasleitung"
      }
    ],
    "B05": [
      {
        "code": "B05.01",
        "label": "Fällung, Rodung, Umpflanzung"
      },
      {
        "code": "B05.02",
        "label": "Nicht kontaminierter Rückbau"
      },
      {
        "code": "B05.03",
        "label": "Kontaminierter Rückbau"
      }
    ],
    "B06": [
      {
        "code": "B06.01",
        "label": "Nicht kontaminierter Aushub",
        "amortizationYears": [
          60
        ]
      },
      {
        "code": "B06.02",
        "label": "Kontaminierter Aushub",
        "amortizationYears": [
          60
        ]
      },
      {
        "code": "B06.03",
        "label": "Böschungssicherung"
      },
      {
        "code": "B06.04",
        "label": "Baugrubenabschluss",
        "amortizationYears": [
          60
        ]
      },
      {
        "code": "B06.05",
        "label": "Materialeinbau"
      },
      {
        "code": "B06.06",
        "label": "Wasserhaltung"
      }
    ],
    "B07": [
      {
        "code": "B07.01",
        "label": "Verbesserung Baugrund"
      },
      {
        "code": "B07.02",
        "label": "Pfählung",
        "amortizationYears": [
          60
        ]
      },
      {
        "code": "B07.03",
        "label": "Unterfangung Bauwerk"
      },
      {
        "code": "B07.04",
        "label": "Sicherung Bauwerk"
      }
    ],
    "B08": [
      {
        "code": "B08.01",
        "label": "Fassadengerüst"
      },
      {
        "code": "B08.02",
        "label": "Arbeitsgerüst"
      },
      {
        "code": "B08.03",
        "label": "Notdach"
      },
      {
        "code": "B08.04",
        "label": "Schutzgerüst"
      }
    ],
    "B09": [
      {
        "code": "B09.01",
        "label": "Bauliche Anpassungen angrenzendes Bauwerk"
      },
      {
        "code": "B09.02",
        "label": "Unterfangung, Sicherung angrenzendes Bauwerk"
      },
      {
        "code": "B09.03",
        "label": "Verkehrsanlage ausserhalb Grundstück"
      }
    ]
  },
  "C": {
    "C01": [
      {
        "code": "C01.01",
        "label": "Unterbau Fundament und Bodenplatte",
        "amortizationYears": [
          60
        ]
      },
      {
        "code": "C01.02",
        "label": "Fundament",
        "amortizationYears": [
          60
        ]
      },
      {
        "code": "C01.03",
        "label": "Bodenplatte",
        "amortizationYears": [
          60
        ]
      },
      {
        "code": "C01.04",
        "label": "Erdverbundene Treppe, Rampe",
        "amortizationYears": [
          60
        ]
      },
      {
        "code": "C01.05",
        "label": "Erdverbundenes Podest",
        "amortizationYears": [
          60
        ]
      }
    ],
    "C02": [
      {
        "code": "C02.01",
        "label": "Aussenwandkonstruktion",
        "amortizationYears": [
          60
        ]
      },
      {
        "code": "C02.02",
        "label": "Innenwandkonstruktion",
        "amortizationYears": [
          60
        ]
      }
    ],
    "C03": [
      {
        "code": "C03.01",
        "label": "Aussenstütze",
        "amortizationYears": [
          60
        ]
      },
      {
        "code": "C03.02",
        "label": "Innenstütze",
        "amortizationYears": [
          60
        ]
      }
    ],
    "C04": [
      {
        "code": "C04.01",
        "label": "Geschossdecke",
        "amortizationYears": [
          60
        ]
      },
      {
        "code": "C04.02",
        "label": "Innen liegende Treppe, Rampe"
      },
      {
        "code": "C04.03",
        "label": "Innen liegende Podeste"
      },
      {
        "code": "C04.04",
        "label": "Konstruktion Flachdach",
        "amortizationYears": [
          60
        ]
      },
      {
        "code": "C04.05",
        "label": "Konstruktion geneigtes Dach",
        "amortizationYears": [
          60
        ]
      },
      {
        "code": "C04.06",
        "label": "Aussen liegende Treppe, Rampe"
      },
      {
        "code": "C04.07",
        "label": "Aussen liegende Podeste"
      },
      {
        "code": "C04.08",
        "label": "Aussen liegende Konstruktion, Vordach",
        "amortizationYears": [
          40
        ]
      }
    ],
    "C05": [
      {
        "code": "C05.01",
        "label": "Durchbruch, Schlitz zu Konstruktion"
      },
      {
        "code": "C05.02",
        "label": "Maschinensockel, Einlage"
      }
    ]
  },
  "D": {
    "D01": [
      {
        "code": "D01.01",
        "label": "Anlage, Erzeugung Starkstrom",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "D01.02",
        "label": "Transformierung Starkstrom",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "D01.03",
        "label": "Speicherung Starkstrom",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "D01.04",
        "label": "Installation Starkstrom",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "D01.05",
        "label": "Verbraucher Starkstrom: Leuchten",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "D01.06",
        "label": "Verbraucher Starkstrom: Elektrogeräte",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "D01.07",
        "label": "Anlage, Erzeugung Schwachstrom",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "D01.08",
        "label": "Transformierung Schwachstrom",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "D01.09",
        "label": "Speicherung Schwachstrom",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "D01.10",
        "label": "Installation Schwachstrom",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "D01.11",
        "label": "Verbraucher Schwachstrom",
        "amortizationYears": [
          30
        ]
      }
    ],
    "D02": [
      {
        "code": "D02.01",
        "label": "Managementebene"
      },
      {
        "code": "D02.02",
        "label": "Automationsebene"
      },
      {
        "code": "D02.03",
        "label": "Feldebene"
      },
      {
        "code": "D02.04",
        "label": "Raumautomation"
      },
      {
        "code": "D02.05",
        "label": "Automationsnetzwerk"
      },
      {
        "code": "D02.06",
        "label": "Schaltgerätekombination"
      },
      {
        "code": "D02.07",
        "label": "Systemintegration"
      }
    ],
    "D03": [
      {
        "code": "D03.01",
        "label": "Einbruchmeldeanlage, Überfallmeldeanlage"
      },
      {
        "code": "D03.02",
        "label": "Zutrittskontrollanlage"
      },
      {
        "code": "D03.03",
        "label": "Videoüberwachungsanlage"
      },
      {
        "code": "D03.04",
        "label": "Schliessanlage"
      }
    ],
    "D04": [
      {
        "code": "D04.01",
        "label": "Brandmeldeanlage"
      },
      {
        "code": "D04.02",
        "label": "Gaswarnanlage"
      },
      {
        "code": "D04.03",
        "label": "Nasslöschanlage"
      },
      {
        "code": "D04.04",
        "label": "Trockenlöschanlage"
      },
      {
        "code": "D04.05",
        "label": "Löschgerät"
      },
      {
        "code": "D04.06",
        "label": "Rauch-  und Wärmebehandlungsanlage"
      },
      {
        "code": "D04.07",
        "label": "Elektroakustische Lautsprecheranlage"
      }
    ],
    "D05": [
      {
        "code": "D05.01",
        "label": "Wärmequelle, -senke, Brennstofflager"
      },
      {
        "code": "D05.02",
        "label": "Wärmeerzeugung",
        "amortizationYears": [
          20,
          40,
          30
        ]
      },
      {
        "code": "D05.03",
        "label": "Wärmespeicherung"
      },
      {
        "code": "D05.04",
        "label": "Wärmeverteilung",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "D05.05",
        "label": "Wärmeabgabe",
        "amortizationYears": [
          30
        ]
      }
    ],
    "D06": [
      {
        "code": "D06.01",
        "label": "Kältequelle, -senke, Brennstofflager"
      },
      {
        "code": "D06.02",
        "label": "Kälteerzeugung"
      },
      {
        "code": "D06.03",
        "label": "Kältespeicherung"
      },
      {
        "code": "D06.04",
        "label": "Kälteverteilung"
      },
      {
        "code": "D06.05",
        "label": "Kälteabgabe"
      }
    ],
    "D07": [
      {
        "code": "D07.01",
        "label": "Aussenluftversorgung, Fortluftführung",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "D07.02",
        "label": "Luftaufbereitung",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "D07.03",
        "label": "Luftwärmespeicherung",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "D07.04",
        "label": "Luftverteilung",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "D07.05",
        "label": "Luftabgabe",
        "amortizationYears": [
          30
        ]
      }
    ],
    "D08": [
      {
        "code": "D08.01",
        "label": "Wasserversorgung",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "D08.02",
        "label": "Wasserbehandlung",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "D08.03",
        "label": "Wasserspeicher",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "D08.04",
        "label": "Wasserverteilung",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "D08.05",
        "label": "Wasser: Armatur, Apparat",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "D08.06",
        "label": "Wasser: Installationselement",
        "amortizationYears": [
          30
        ]
      }
    ],
    "D09": [
      {
        "code": "D09.01",
        "label": "Abwasserentsorgung"
      },
      {
        "code": "D09.02",
        "label": "Abwasserbehandlung"
      },
      {
        "code": "D09.03",
        "label": "Abwasserspeicher"
      },
      {
        "code": "D09.04",
        "label": "Abwassersammlung"
      },
      {
        "code": "D09.05",
        "label": "Abwasser: Armatur, Apparat"
      }
    ],
    "D10": [
      {
        "code": "D10.01",
        "label": "Gasversorgung"
      },
      {
        "code": "D10.02",
        "label": "Gasbehandlung"
      },
      {
        "code": "D10.03",
        "label": "Gasspeicherung"
      },
      {
        "code": "D10.04",
        "label": "Gasverteilung"
      },
      {
        "code": "D10.05",
        "label": "Gas: Armatur, Apparat"
      }
    ],
    "D11": [
      {
        "code": "D11.01",
        "label": "Spezialmedien: Versorgung, Entsorgung"
      },
      {
        "code": "D11.02",
        "label": "Spezialmedien: Aufbereitung"
      },
      {
        "code": "D11.03",
        "label": "Spezialmedien: Speicherung"
      },
      {
        "code": "D11.04",
        "label": "Spezialmedien: Verteilung"
      },
      {
        "code": "D11.05",
        "label": "Spezialmedien: Armatur, Apparat"
      }
    ],
    "D12": [
      {
        "code": "D12.01",
        "label": "Personenaufzug"
      },
      {
        "code": "D12.02",
        "label": "Lasten- und Serviceaufzug"
      },
      {
        "code": "D12.03",
        "label": "Spezialaufzug"
      },
      {
        "code": "D12.04",
        "label": "Fahrtreppe"
      },
      {
        "code": "D12.05",
        "label": "Fahrsteig"
      },
      {
        "code": "D12.06",
        "label": "Hebeeinrichtung, Verladestation"
      }
    ]
  },
  "E": {
    "E01": [
      {
        "code": "E01.01",
        "label": "Wandabdichtung unter Terrain",
        "amortizationYears": [
          60
        ]
      },
      {
        "code": "E01.02",
        "label": "Aussenwärmedämmung unter Terrain",
        "amortizationYears": [
          60
        ]
      },
      {
        "code": "E01.03",
        "label": "Schutzschicht unter Terrain",
        "amortizationYears": [
          60
        ]
      }
    ],
    "E02": [
      {
        "code": "E02.01",
        "label": "Äussere Beschichtung",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "E02.02",
        "label": "Aussenwärmedämmsystem",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "E02.03",
        "label": "Fassadenbekleidung",
        "amortizationYears": [
          40
        ]
      },
      {
        "code": "E02.04",
        "label": "Systemfassade",
        "amortizationYears": [
          40
        ]
      },
      {
        "code": "E02.05",
        "label": "Fassadenbekleidung Untersicht",
        "amortizationYears": [
          40
        ]
      },
      {
        "code": "E02.06",
        "label": "Aussenliegende Absturzssicherung"
      }
    ],
    "E03": [
      {
        "code": "E03.01",
        "label": "Fenster",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "E03.02",
        "label": "Aussentür",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "E03.03",
        "label": "Aussentor",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "E03.04",
        "label": "Sonnenschutz, Wetterschutz",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "E03.05",
        "label": "Absturzsicherung",
        "amortizationYears": [
          30
        ]
      }
    ]
  },
  "F": {
    "F01": [
      {
        "code": "F01.01",
        "label": "Dachabdichtung unter Terrain",
        "amortizationYears": [
          60
        ]
      },
      {
        "code": "F01.02",
        "label": "Bedachung Flachdach",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "F01.03",
        "label": "Bedachung geneigtes Dach",
        "amortizationYears": [
          40
        ]
      },
      {
        "code": "F01.04",
        "label": "Systemdach"
      }
    ],
    "F02": [
      {
        "code": "F02.01",
        "label": "Element zu Flachdach",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "F02.02",
        "label": "Element zu geneigtem Dach",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "F02.03",
        "label": "Schutzanlage zu Dach",
        "amortizationYears": [
          30
        ]
      }
    ]
  },
  "G": {
    "G01": [
      {
        "code": "G01.01",
        "label": "Fest stehende Trennwand",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "G01.02",
        "label": "Bewegliche Trennwand",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "G01.03",
        "label": "Schachtfront",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "G01.04",
        "label": "Innenfenster",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "G01.05",
        "label": "Innentür",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "G01.06",
        "label": "Innentor",
        "amortizationYears": [
          30
        ]
      }
    ],
    "G02": [
      {
        "code": "G02.01",
        "label": "Unterkonstruktion zu Bodenbelag",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "G02.02",
        "label": "Bodenbelag",
        "amortizationYears": [
          30
        ]
      }
    ],
    "G03": [
      {
        "code": "G03.01",
        "label": "Unterkonstruktion zu Wandbekleidung",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "G03.02",
        "label": "Wandbekleidung",
        "amortizationYears": [
          30
        ]
      }
    ],
    "G04": [
      {
        "code": "G04.01",
        "label": "Unterkonstruktion zu Deckenbekleidung",
        "amortizationYears": [
          30
        ]
      },
      {
        "code": "G04.02",
        "label": "Deckenbekleidung",
        "amortizationYears": [
          30
        ]
      }
    ],
    "G05": [
      {
        "code": "G05.01",
        "label": "Einbauschrank, Regal, Ablage"
      },
      {
        "code": "G05.02",
        "label": "Einbauküche"
      },
      {
        "code": "G05.03",
        "label": "Innerer Fensterausbau"
      },
      {
        "code": "G05.04",
        "label": "Innerer Abschluss"
      },
      {
        "code": "G05.05",
        "label": "Absturz-, Anprallschutzeinrichtung"
      },
      {
        "code": "G05.06",
        "label": "Sonderbauteil"
      },
      {
        "code": "G05.07",
        "label": "Kleinbauteil, Schutzraumeinrichtung"
      }
    ],
    "G06": [
      {
        "code": "G06.01",
        "label": "Durchbruch, Schlitz zu Ausbau"
      },
      {
        "code": "G06.02",
        "label": "Abschottung"
      },
      {
        "code": "G06.03",
        "label": "Reinigung"
      },
      {
        "code": "G06.04",
        "label": "Trocknung"
      }
    ]
  },
  "H": {
    "H01": [
      {
        "code": "H01.01",
        "label": "Produktionsanlage: Versorgung, Entsorgung"
      },
      {
        "code": "H01.02",
        "label": "Produktionsanlage: Aufbereitung"
      },
      {
        "code": "H01.03",
        "label": "Produktionsanlage: Speicherung"
      },
      {
        "code": "H01.04",
        "label": "Produktionsanlage: Verteilung"
      },
      {
        "code": "H01.05",
        "label": "Produktionsanlage: Armatur, Apparat"
      }
    ],
    "H02": [
      {
        "code": "H02.01",
        "label": "Laboranlage: Versorgung, Entsorgung"
      },
      {
        "code": "H02.02",
        "label": "Laboranlage: Aufbereitung"
      },
      {
        "code": "H02.03",
        "label": "Laboranlage: Speicherung"
      },
      {
        "code": "H02.04",
        "label": "Laboranlage: Verteilung"
      },
      {
        "code": "H02.05",
        "label": "Laboranlage: Armatur, Apparat"
      }
    ],
    "H03": [
      {
        "code": "H03.01",
        "label": "Grossküche: Versorgung, Entsorgung"
      },
      {
        "code": "H03.02",
        "label": "Grossküche: Aufbereitung"
      },
      {
        "code": "H03.03",
        "label": "Grossküche: Lagerung"
      },
      {
        "code": "H03.04",
        "label": "Grossküche: Verteilung"
      },
      {
        "code": "H03.05",
        "label": "Grossküche: Armatur, Apparat"
      }
    ],
    "H04": [
      {
        "code": "H04.01",
        "label": "Wäscherei-, Reinigungsanlage: Versorgung, Entsorgung"
      },
      {
        "code": "H04.02",
        "label": "Wäscherei-, Reinigungsanlage: Aufbereitung"
      },
      {
        "code": "H04.03",
        "label": "Wäscherei-, Reinigungsanlage: Speicherung"
      },
      {
        "code": "H04.04",
        "label": "Wäscherei-, Reinigungsanlage: Verteilung"
      },
      {
        "code": "H04.05",
        "label": "Wäscherei-, Reinigungsanlage: Armaturen, Apparat"
      }
    ],
    "H05": [
      {
        "code": "H05.01",
        "label": "Gerät für Vitaldatenüberwachung"
      },
      {
        "code": "H05.02",
        "label": "Einrichtung für Diagnostik"
      },
      {
        "code": "H05.03",
        "label": "Gerät für Behandlung, Pflege"
      },
      {
        "code": "H05.04",
        "label": "Medizinisches Kälte- / Wärmegerät"
      },
      {
        "code": "H05.04",
        "label": "Medizinisches Kälte- / Wärmegerät"
      },
      {
        "code": "H05.05",
        "label": "Mess-, Analysetechnik"
      },
      {
        "code": "H05.06",
        "label": "Reinigung, Desinfektion, Sterilisation"
      },
      {
        "code": "H05.06",
        "label": "Reinigung, Desinfektion, Sterilisation"
      },
      {
        "code": "H05.06",
        "label": "Reinigung, Desinfektion, Sterilisation"
      },
      {
        "code": "H05.07",
        "label": "Medizinische Einrichtung, Ausstattung"
      },
      {
        "code": "H05.08",
        "label": "Medizinischer Beleuchtungskörper"
      },
      {
        "code": "H05.09",
        "label": "Medizinische Textilien"
      },
      {
        "code": "H05.10",
        "label": "Medizinisches Kleininventar"
      },
      {
        "code": "H05.11",
        "label": "Medizinisches Transportmittel"
      },
      {
        "code": "H05.12",
        "label": "Medizinisches Betriebsmittel"
      }
    ],
    "H06": [
      {
        "code": "H06.01",
        "label": "Bildung, Kultur: Versorgung, Entsorgung"
      },
      {
        "code": "H06.02",
        "label": "Bildung, Kultur: Apparat"
      },
      {
        "code": "H06.03",
        "label": "Bildung, Kultur: Steuerung"
      },
      {
        "code": "H06.04",
        "label": "Bildung Kultur: Einbauten"
      }
    ],
    "H07": [
      {
        "code": "H07.01",
        "label": "Sportanlage, Freizeitanlage: Versorgung, Entsorgung"
      },
      {
        "code": "H07.02",
        "label": "Sportanlage, Freizeitanlage: Apparat"
      },
      {
        "code": "H07.03",
        "label": "Sportanlage, Freizeitanlage: Steuerung"
      },
      {
        "code": "H07.04",
        "label": "Sportanlage, Freizeitanlage: Einbauten"
      }
    ],
    "H08": [
      {
        "code": "H08.01",
        "label": "Erholungsanlage: Versorgung, Entsorgung"
      },
      {
        "code": "H08.02",
        "label": "Erholungsanlage: Apparat"
      },
      {
        "code": "H08.03",
        "label": "Erholungsanlage: Steuerung"
      },
      {
        "code": "H08.04",
        "label": "Erholungsanlage: Einbaute"
      }
    ],
    "H09": [
      {
        "code": "H09.01",
        "label": "Nutzungsspezifische Anlage: Versorgung, Entsorgung"
      },
      {
        "code": "H09.02",
        "label": "Nutzungsspezifische Anlage: Aufbereitung"
      },
      {
        "code": "H09.03",
        "label": "Nutzungsspezifische Anlage: Speicherung, Lagerung"
      },
      {
        "code": "H09.04",
        "label": "Nutzungsspezifische Anlage: Verteilung"
      },
      {
        "code": "H09.05",
        "label": "Nutzungsspezifische Anlage: Armatur, Apparat"
      },
      {
        "code": "H09.06",
        "label": "Parkieranlage"
      },
      {
        "code": "H09.07",
        "label": "Materialtransportanlage"
      },
      {
        "code": "H09.08",
        "label": "Kühlzelle"
      },
      {
        "code": "H09.09",
        "label": "Lagereinrichtung"
      }
    ]
  },
  "I": {
    "I01": [
      {
        "code": "I01.01",
        "label": "Geländeanpassung"
      },
      {
        "code": "I01.02",
        "label": "Tief liegende Entwässerung"
      }
    ],
    "I02": [
      {
        "code": "I02.01",
        "label": "Böschungsverbau"
      },
      {
        "code": "I02.02",
        "label": "Stützmauer"
      },
      {
        "code": "I02.03",
        "label": "Frei stehende Wand"
      },
      {
        "code": "I02.04",
        "label": "Treppe, Rampe"
      },
      {
        "code": "I02.05",
        "label": "Kleinbauwerk"
      },
      {
        "code": "I02.06",
        "label": "Unterirdisches Bauwerk"
      },
      {
        "code": "I02.07",
        "label": "Absturz-, Anprallschutzeinrichtungen für Umgebung"
      },
      {
        "code": "I02.08",
        "label": "Einfriedung"
      }
    ],
    "I03": [
      {
        "code": "I03.01",
        "label": "Vegetationstragschicht"
      },
      {
        "code": "I03.02",
        "label": "Saatfläche"
      },
      {
        "code": "I03.03",
        "label": "Flächenbepflanzung, Hecke"
      },
      {
        "code": "I03.04",
        "label": "Vertikale Begrünung"
      },
      {
        "code": "I03.05",
        "label": "Einzelbepflanzung"
      },
      {
        "code": "I03.06",
        "label": "Einfassung, Abschluss Grünfläche"
      },
      {
        "code": "I03.07",
        "label": "Naturnahe Wasserfläche"
      },
      {
        "code": "I03.08",
        "label": "Ingenieurbiologische Massnahme"
      },
      {
        "code": "I03.09",
        "label": "Pflegemassnahme bis Übergabe"
      }
    ],
    "I04": [
      {
        "code": "I04.01",
        "label": "Fundations-, Tragschicht"
      },
      {
        "code": "I04.02",
        "label": "Einfassung, Abschluss Hartfläche"
      },
      {
        "code": "I04.03",
        "label": "Deckschicht"
      },
      {
        "code": "I04.04",
        "label": "Bodenmarkierung"
      }
    ],
    "I05": [
      {
        "code": "I05.01",
        "label": "Elektroanlage Starkstrom für Umgebung"
      },
      {
        "code": "I05.02",
        "label": "Elektroanlage Schwachstrom für Umgebung"
      },
      {
        "code": "I05.03",
        "label": "Wärmeanlage für Umgebung"
      },
      {
        "code": "I05.04",
        "label": "Kälteanlage für Umgebung"
      },
      {
        "code": "I05.05",
        "label": "Sanitäre Anlage für Umgebung"
      },
      {
        "code": "I05.06",
        "label": "Oberflächenentwässerung für Umgebung"
      },
      {
        "code": "I05.07",
        "label": "Transportanlage in Umgebung"
      },
      {
        "code": "I05.08",
        "label": "Perimeterschutz"
      }
    ],
    "I06": [
      {
        "code": "I06.01",
        "label": "Mobile Ausstattung für Umgebung"
      },
      {
        "code": "I06.02",
        "label": "Fixierte Ausstattung für Umgebung"
      },
      {
        "code": "I06.03",
        "label": "Spiel-, Sportgerät für Umgebung"
      },
      {
        "code": "I06.04",
        "label": "Abfallentsorgungseinrichtung für Umgebung"
      }
    ]
  },
  "J": {
    "J01": [
      {
        "code": "J01.01",
        "label": "Allgemeines Mobiliar"
      },
      {
        "code": "J01.02",
        "label": "Nutzungsspezifisches Mobiliar"
      },
      {
        "code": "J01.03",
        "label": "Mobile Leuchte"
      },
      {
        "code": "J01.04",
        "label": "Signaletik"
      }
    ],
    "J02": [
      {
        "code": "J02.01",
        "label": "Allgemeines Kleininventar"
      },
      {
        "code": "J02.02",
        "label": "Nutzungsspezifisches Kleininventar"
      },
      {
        "code": "J02.03",
        "label": "Mobiles Gerät"
      }
    ],
    "J03": [
      {
        "code": "J03.01",
        "label": "Allgemeine Textilien"
      },
      {
        "code": "J03.02",
        "label": "Nutzungsspezifische Textilien"
      }
    ],
    "J04": [
      {
        "code": "J04.01",
        "label": "Kunstobjekt"
      },
      {
        "code": "J04.02",
        "label": "Künstlerisch gestaltetes Bauteil"
      }
    ]
  }
} as const;

export const ELEMENTS_WITH_AMORTIZATION = [
  { code: 'B06.01', label: 'Nicht kontaminierter Aushub', amortizationYears: [60] },
  { code: 'B06.02', label: 'Kontaminierter Aushub', amortizationYears: [60] },
  { code: 'B06.04', label: 'Baugrubenabschluss', amortizationYears: [60] },
  { code: 'B07.02', label: 'Pfählung', amortizationYears: [60] },
  { code: 'C01.01', label: 'Unterbau Fundament und Bodenplatte', amortizationYears: [60] },
  { code: 'C01.02', label: 'Fundament', amortizationYears: [60] },
  { code: 'C01.03', label: 'Bodenplatte', amortizationYears: [60] },
  { code: 'C01.04', label: 'Erdverbundene Treppe, Rampe', amortizationYears: [60] },
  { code: 'C01.05', label: 'Erdverbundenes Podest', amortizationYears: [60] },
  { code: 'C02.01', label: 'Aussenwandkonstruktion', amortizationYears: [60] },
  { code: 'C02.02', label: 'Innenwandkonstruktion', amortizationYears: [60] },
  { code: 'C03.01', label: 'Aussenstütze', amortizationYears: [60] },
  { code: 'C03.02', label: 'Innenstütze', amortizationYears: [60] },
  { code: 'C04.01', label: 'Geschossdecke', amortizationYears: [60] },
  { code: 'C04.04', label: 'Konstruktion Flachdach', amortizationYears: [60] },
  { code: 'C04.05', label: 'Konstruktion geneigtes Dach', amortizationYears: [60] },
  { code: 'C04.08', label: 'Aussen liegende Konstruktion, Vordach', amortizationYears: [40] },
  { code: 'D01.01', label: 'Anlage, Erzeugung Starkstrom', amortizationYears: [30] },
  { code: 'D01.02', label: 'Transformierung Starkstrom', amortizationYears: [30] },
  { code: 'D01.03', label: 'Speicherung Starkstrom', amortizationYears: [30] },
  { code: 'D01.04', label: 'Installation Starkstrom', amortizationYears: [30] },
  { code: 'D01.05', label: 'Verbraucher Starkstrom: Leuchten', amortizationYears: [30] },
  { code: 'D01.06', label: 'Verbraucher Starkstrom: Elektrogeräte', amortizationYears: [30] },
  { code: 'D01.07', label: 'Anlage, Erzeugung Schwachstrom', amortizationYears: [30] },
  { code: 'D01.08', label: 'Transformierung Schwachstrom', amortizationYears: [30] },
  { code: 'D01.09', label: 'Speicherung Schwachstrom', amortizationYears: [30] },
  { code: 'D01.10', label: 'Installation Schwachstrom', amortizationYears: [30] },
  { code: 'D01.11', label: 'Verbraucher Schwachstrom', amortizationYears: [30] },
  { code: 'D05.02', label: 'Wärmeerzeugung', amortizationYears: [20, 40, 30] },
  { code: 'D05.04', label: 'Wärmeverteilung', amortizationYears: [30] },
  { code: 'D05.05', label: 'Wärmeabgabe', amortizationYears: [30] },
  { code: 'D07.01', label: 'Aussenluftversorgung, Fortluftführung', amortizationYears: [30] },
  { code: 'D07.02', label: 'Luftaufbereitung', amortizationYears: [30] },
  { code: 'D07.03', label: 'Luftwärmespeicherung', amortizationYears: [30] },
  { code: 'D07.04', label: 'Luftverteilung', amortizationYears: [30] },
  { code: 'D07.05', label: 'Luftabgabe', amortizationYears: [30] },
  { code: 'D08.01', label: 'Wasserversorgung', amortizationYears: [30] },
  { code: 'D08.02', label: 'Wasserbehandlung', amortizationYears: [30] },
  { code: 'D08.03', label: 'Wasserspeicher', amortizationYears: [30] },
  { code: 'D08.04', label: 'Wasserverteilung', amortizationYears: [30] },
  { code: 'D08.05', label: 'Wasser: Armatur, Apparat', amortizationYears: [30] },
  { code: 'D08.06', label: 'Wasser: Installationselement', amortizationYears: [30] },
  { code: 'E01.01', label: 'Wandabdichtung unter Terrain', amortizationYears: [60] },
  { code: 'E01.02', label: 'Aussenwärmedämmung unter Terrain', amortizationYears: [60] },
  { code: 'E01.03', label: 'Schutzschicht unter Terrain', amortizationYears: [60] },
  { code: 'E02.01', label: 'Äussere Beschichtung', amortizationYears: [30] },
  { code: 'E02.02', label: 'Aussenwärmedämmsystem', amortizationYears: [30] },
  { code: 'E02.03', label: 'Fassadenbekleidung', amortizationYears: [40] },
  { code: 'E02.04', label: 'Systemfassade', amortizationYears: [40] },
  { code: 'E02.05', label: 'Fassadenbekleidung Untersicht', amortizationYears: [40] },
  { code: 'E03.01', label: 'Fenster', amortizationYears: [30] },
  { code: 'E03.02', label: 'Aussentür', amortizationYears: [30] },
  { code: 'E03.03', label: 'Aussentor', amortizationYears: [30] },
  { code: 'E03.04', label: 'Sonnenschutz, Wetterschutz', amortizationYears: [30] },
  { code: 'E03.05', label: 'Absturzsicherung', amortizationYears: [30] },
  { code: 'F01.01', label: 'Dachabdichtung unter Terrain', amortizationYears: [60] },
  { code: 'F01.02', label: 'Bedachung Flachdach', amortizationYears: [30] },
  { code: 'F01.03', label: 'Bedachung geneigtes Dach', amortizationYears: [40] },
  { code: 'F02.01', label: 'Element zu Flachdach', amortizationYears: [30] },
  { code: 'F02.02', label: 'Element zu geneigtem Dach', amortizationYears: [30] },
  { code: 'F02.03', label: 'Schutzanlage zu Dach', amortizationYears: [30] },
  { code: 'G01.01', label: 'Fest stehende Trennwand', amortizationYears: [30] },
  { code: 'G01.02', label: 'Bewegliche Trennwand', amortizationYears: [30] },
  { code: 'G01.03', label: 'Schachtfront', amortizationYears: [30] },
  { code: 'G01.04', label: 'Innenfenster', amortizationYears: [30] },
  { code: 'G01.05', label: 'Innentür', amortizationYears: [30] },
  { code: 'G01.06', label: 'Innentor', amortizationYears: [30] },
  { code: 'G02.01', label: 'Unterkonstruktion zu Bodenbelag', amortizationYears: [30] },
  { code: 'G02.02', label: 'Bodenbelag', amortizationYears: [30] },
  { code: 'G03.01', label: 'Unterkonstruktion zu Wandbekleidung', amortizationYears: [30] },
  { code: 'G03.02', label: 'Wandbekleidung', amortizationYears: [30] },
  { code: 'G04.01', label: 'Unterkonstruktion zu Deckenbekleidung', amortizationYears: [30] },
  { code: 'G04.02', label: 'Deckenbekleidung', amortizationYears: [30] }
] as const;

export const AMORTIZATION_LOOKUP = new Map<string, number[]>([
  ['B06.01', [60]],
  ['B06.02', [60]],
  ['B06.04', [60]],
  ['B07.02', [60]],
  ['C01.01', [60]],
  ['C01.02', [60]],
  ['C01.03', [60]],
  ['C01.04', [60]],
  ['C01.05', [60]],
  ['C02.01', [60]],
  ['C02.02', [60]],
  ['C03.01', [60]],
  ['C03.02', [60]],
  ['C04.01', [60]],
  ['C04.04', [60]],
  ['C04.05', [60]],
  ['C04.08', [40]],
  ['D01.01', [30]],
  ['D01.02', [30]],
  ['D01.03', [30]],
  ['D01.04', [30]],
  ['D01.05', [30]],
  ['D01.06', [30]],
  ['D01.07', [30]],
  ['D01.08', [30]],
  ['D01.09', [30]],
  ['D01.10', [30]],
  ['D01.11', [30]],
  ['D05.02', [20, 40, 30]],
  ['D05.04', [30]],
  ['D05.05', [30]],
  ['D07.01', [30]],
  ['D07.02', [30]],
  ['D07.03', [30]],
  ['D07.04', [30]],
  ['D07.05', [30]],
  ['D08.01', [30]],
  ['D08.02', [30]],
  ['D08.03', [30]],
  ['D08.04', [30]],
  ['D08.05', [30]],
  ['D08.06', [30]],
  ['E01.01', [60]],
  ['E01.02', [60]],
  ['E01.03', [60]],
  ['E02.01', [30]],
  ['E02.02', [30]],
  ['E02.03', [40]],
  ['E02.04', [40]],
  ['E02.05', [40]],
  ['E03.01', [30]],
  ['E03.02', [30]],
  ['E03.03', [30]],
  ['E03.04', [30]],
  ['E03.05', [30]],
  ['F01.01', [60]],
  ['F01.02', [30]],
  ['F01.03', [40]],
  ['F02.01', [30]],
  ['F02.02', [30]],
  ['F02.03', [30]],
  ['G01.01', [30]],
  ['G01.02', [30]],
  ['G01.03', [30]],
  ['G01.04', [30]],
  ['G01.05', [30]],
  ['G01.06', [30]],
  ['G02.01', [30]],
  ['G02.02', [30]],
  ['G03.01', [30]],
  ['G03.02', [30]],
  ['G04.01', [30]],
  ['G04.02', [30]]
]);