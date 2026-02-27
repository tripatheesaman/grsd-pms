const fs = require("fs");
const path = require("path");

// All checksheet PDF filenames as provided (no spaces)
const fileNames = [
  "1003-1004_A.pdf","1003-1004_B.pdf","1003-1004_C.pdf",
  "1005_A.pdf","1005_B.pdf",
  "109-113_A.pdf","109-113_B.pdf","109-113_C.pdf",
  "1102-1104_A.pdf","1102-1104_B.pdf","1102-1104_C.pdf",
  "1105_A.pdf","1105_B.pdf","1105_C.pdf","1105_D.pdf","1105_E.pdf","1105_F.pdf","1105_G.pdf","1105_H.pdf","1105_I.pdf","1105_J.pdf",
  "1106_A.pdf","1106_B.pdf","1106_C.pdf","1106_D.pdf","1106_E.pdf","1106_F.pdf","1106_G.pdf",
  "1107_A.pdf","1107_B.pdf","1107_C.pdf","1107_D.pdf",
  "1108-1109_A.pdf","1108-1109_B.pdf","1108-1109_C.pdf","1108-1109_D.pdf","1108-1109_E.pdf","1108-1109_F.pdf",
  "1111_A.pdf","1111_B.pdf","1111_C.pdf","1111_D.pdf",
  "1221_A.pdf","1221_B.pdf",
  "1230-1233_A.pdf","1230-1233_B.pdf",
  "1234-1237_A.pdf","1234-1237_B.pdf","1234-1237_C.pdf","1234-1237_D.pdf","1234-1237_E.pdf","1234-1237_F.pdf","1234-1237_G.pdf",
  "1403_A.pdf","1403_B.pdf",
  "1404_A.pdf","1404_B.pdf","1404_C.pdf","1404_D.pdf","1404_E.pdf","1404_F.pdf",
  "1405_A.pdf","1405_B.pdf","1405_C.pdf","1405_D.pdf","1405_E.pdf",
  "1504-1505_A.pdf","1504-1505_B.pdf",
  "1508-1509_A.pdf","1508-1509_B.pdf",
  "1510_A.pdf","1510_B.pdf","1510_C.pdf",
  "1602_A.pdf","1602_B.pdf",
  "1603_A.pdf","1603_B.pdf","1603_C.pdf","1603_D.pdf",
  "204_A.pdf","204_B.pdf",
  "205_A.pdf","205_B.pdf","205_C.pdf","205_D.pdf",
  "2107_A.pdf","2107_B.pdf",
  "2108-2109_A.pdf","2108-2109_B.pdf","2108-2109_C.pdf",
  "2108-2113_A.pdf","2108-2113_B.pdf","2108-2113_C.pdf",
  "2114-2115_A.pdf","2114-2115_B.pdf","2114-2115_C.pdf","2114-2115_D.pdf","2114-2115_E.pdf",
  "2301-2302_A.pdf","2301-2302_B.pdf",
  "2401_A.pdf","2401_B.pdf",
  "2402_A.pdf","2402_B.pdf","2402_C.pdf","2402_D.pdf",
  "327-330_A.pdf",
  "333-338_A.pdf","333-338_B.pdf","333-338_C.pdf",
  "339-343_A.pdf","339-343_B.pdf","339-343_C.pdf",
  "347-353_A.pdf","347-353_B.pdf","347-353_C.pdf",
  "417-20_A.pdf","417-20_B.pdf","417-20_C.pdf",
  "417-420_A.pdf","417-420_B.pdf","417-420_C.pdf",
  "421-422_A.pdf","421-422_B.pdf","421-422_C.pdf",
  "427-430_A.pdf","427-430_B.pdf","427-430_C.pdf","427-430_D.pdf","427-430_E.pdf","427-430_F.pdf","427-430_G.pdf",
  "431-442_A.pdf","431-442_B.pdf","431-442_C.pdf",
  "505-506_A.pdf","505-506_B.pdf",
  "507_A.pdf","507_B.pdf","507_C.pdf","507_D.pdf",
  "608-613_A.pdf","608-613_B.pdf","608-613_C.pdf",
  "614_A.pdf","614_B.pdf","614_C.pdf","614_D.pdf","614_E.pdf",
  "618_A.pdf","618_B.pdf","618_C.pdf","618_D.pdf","618_E.pdf",
  "626-633_C.pdf",
  "702_A.pdf","702_B.pdf",
  "703_A.pdf","703_B.pdf"
];

function expandRangeToken(rangeToken) {
  const [startStr, endStrRaw] = rangeToken.split("-");
  if (!endStrRaw) return [startStr];

  // Handle shorthand like 417-20 => 417-420
  let endStr = endStrRaw;
  if (endStrRaw.length < startStr.length) {
    const prefix = startStr.slice(0, startStr.length - endStrRaw.length);
    endStr = prefix + endStrRaw;
  }

  const start = parseInt(startStr, 10);
  const end = parseInt(endStr, 10);
  const result = [];
  for (let n = start; n <= end; n++) {
    result.push(String(n));
  }
  return result;
}

// Map: equipmentNumber -> Set<checkCode>
const equipmentChecks = new Map();

for (const file of fileNames) {
  const base = file.replace(/\.pdf$/i, "");
  const [rangeToken, code] = base.split("_");
  if (!rangeToken || !code) continue;

  const equipments = expandRangeToken(rangeToken);
  for (const eq of equipments) {
    if (!equipmentChecks.has(eq)) {
      equipmentChecks.set(eq, new Set());
    }
    equipmentChecks.get(eq).add(code);
  }
}

const sortedEquipment = Array.from(equipmentChecks.keys()).sort(
  (a, b) => parseInt(a, 10) - parseInt(b, 10)
);

const outDir = path.join(process.cwd(), "import-templates");
fs.mkdirSync(outDir, { recursive: true });

// Equipment master template
const equipmentMasterPath = path.join(outDir, "EquipmentMasterTemplate.csv");
{
  const header = [
    "equipmentNumber",
    "displayName",
    "averageHoursPerDay",
    "currentHours",
    "lastCheckCode",
    "lastCheckHours",
    "lastCheckDate"
  ];
  const lines = [header.join(",")];

  for (const eq of sortedEquipment) {
    const row = [
      eq,            // equipmentNumber
      eq,            // displayName (same as number by default)
      "",            // averageHoursPerDay
      "",            // currentHours
      "",            // lastCheckCode
      "",            // lastCheckHours
      ""             // lastCheckDate
    ];
    lines.push(row.join(","));
  }

  fs.writeFileSync(equipmentMasterPath, lines.join("\n"), "utf8");
}

// Check rules template
const checkRulesPath = path.join(outDir, "EquipmentCheckRulesTemplate.csv");
{
  const header = [
    "equipmentNumber",
    "checkCode",
    "intervalHours",
    "approachingOffsetHours",
    "issueOffsetHours",
    "nearOffsetHours"
  ];
  const lines = [header.join(",")];

  for (const eq of sortedEquipment) {
    const codes = Array.from(equipmentChecks.get(eq)).sort();
    for (const code of codes) {
      const row = [
        eq,      // equipmentNumber
        code,    // checkCode
        "",      // intervalHours (to be filled)
        "120",   // approachingOffsetHours default
        "40",    // issueOffsetHours default
        "10"     // nearOffsetHours default
      ];
      lines.push(row.join(","));
    }
  }

  fs.writeFileSync(checkRulesPath, lines.join("\n"), "utf8");
}

console.log("Generated:");
console.log(" -", path.relative(process.cwd(), equipmentMasterPath));
console.log(" -", path.relative(process.cwd(), checkRulesPath));

