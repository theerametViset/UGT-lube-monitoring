// AUTO-GENERATED from PM_Master_Plan_Lubrication_2026_Equipment.xlsx
// Generated on 2026-08-31 — 891 assets
// Plants: CPL, TSL, UFA, UNT, UTCA
//
// LOCAL PREVIEW ONLY — real equipment data so the app renders without a live database.
// Gated by lib/env isDemoMode(); never used in production.
//
// Asset data above the "Stub functions" section are the real Excel-derived
// records. The oil/vibration lab-reading history and maintenance records
// further below are illustrative seed data (not from the source Excel) added
// so every module has something to show in Demo Mode.
import type {
  AlarmParam,
  Asset,
  AssetAlarmOverride,
  AssetScoreOverride,
  AssetType,
  MaintenanceRecord,
  OilReading,
  Permission,
  Role,
  ScoreConfig,
  Site,
  Standard,
  VibReading,
} from "@/lib/types";
import type { ReferenceData } from "@/lib/queries/assets";
import { getDeductionBreakdown } from "@/lib/scoring/audit";
import { statusFromHealth } from "@/lib/scoring/health";
import { isLocalStore } from "@/lib/env";
import { getLocalOil, getLocalVib, localStoreVersion, mergeHistory } from "@/lib/local-store";

// ── Asset data from Excel ──
// [id, name, type, site, install_date, motor_kw, rpm, vg_grade, oil_brand,
//  oil_qty_l, oil_change_months, oil_sample_months, last_update]
// No health/status columns: getDemoAssets() computes them from the readings.
const RAW_ASSETS: [string, string, string, string, string | null, number | null, number | null, number, string | null, number, number, number, string | null][] = [
  ["1130-P09-A","HOT WATER PUMP A","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.5,6,3,"2026-07"],
  ["1130-P09-B","HOT WATER PUMP B","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.5,6,3,"2026-07"],
  ["1130-P13-A","HP CONDENSATE FEED PUMP A","Centrifugal Pump","CPL",null,null,null,46,"PTT",2,6,3,"2026-07"],
  ["1130-P13-B","HP CONDENSATE FEED PUMP B","Centrifugal Pump","CPL",null,null,null,46,"PTT",2,6,3,"2026-07"],
  ["1330-P12-A","HOT WATER PUMP A","Centrifugal Pump","CPL",null,null,null,46,"PTT",3.5,6,3,"2026-07"],
  ["1330-P12-B","HOT WATER PUMP B","Centrifugal Pump","CPL",null,null,null,46,"PTT",3.5,6,3,"2026-07"],
  ["5620-P03-A","Pure Lactam Feed Pump A","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.4,6,3,"2026-07"],
  ["5620-P03-B","Pure Lactam Feed Pump B","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.4,6,3,"2026-07"],
  ["5620-P03-C","Pure Lactam Feed Pump C","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.4,6,3,"2026-07"],
  ["5620-P04-A","Lactam Transfer Pump A","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.4,6,3,"2026-07"],
  ["5620-P04-B","Lactam Transfer Pump B","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.4,6,3,"2026-07"],
  ["2030-B01-3","COOLING TOWER FAN C","Axial Blower","CPL",null,null,null,220,"MOBIL",80,12,6,"2026-11"],
  ["2030-P01-A","COOLING WATER PUMP A","Axial Split Pump","CPL",null,null,null,46,"PTT",4,6,3,"2026-07"],
  ["2030-P01-B","COOLING WATER PUMP B","Axial Split Pump","CPL",null,null,null,46,"PTT",4,6,3,"2026-07"],
  ["2030-P01-C","COOLING WATER PUMP C","Axial Split Pump","CPL",null,null,null,46,"PTT",4,6,3,"2026-07"],
  ["2030-P01-D","COOLING WATER PUMP D","Axial Split Pump","CPL",null,null,null,46,"PTT",4,6,3,"2026-07"],
  ["2030-S01-A","SIDE STREAM FILTER","Self-Cleaning Strainer","CPL",null,null,null,320,"MOBIL",0.6,6,3,"2026-07"],
  ["2030-S01-B","SIDE STREAM FILTER","Self-Cleaning Strainer","CPL",null,null,null,320,"MOBIL",0.6,6,3,"2026-07"],
  ["2100-P01-A","DMW FEED PUMP A","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.6,6,3,"2026-07"],
  ["2100-P01-B","DMW FEED PUMP B","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.6,6,3,"2026-07"],
  ["2100-P02-A","DEAERAOR WATER FEED PUMP","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.3,6,3,"2026-07"],
  ["2100-P02-B","DEAERAOR WATER FEED PUMP","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.3,6,3,"2026-07"],
  ["2110-P01-A","POTABLE WATER PUMP A","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.3,6,3,"2026-07"],
  ["2110-P01-B","POTABLE WATER PUMP B","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.3,6,3,"2026-07"],
  ["2400-K03","PLANT AIR COMPRESSOR","Screw Compressor","CPL",null,null,null,68,"ATLAS",85,6,3,"2026-11"],
  ["2400-K04","PLANT AIR COMPRESSOR","Screw Compressor","CPL",null,null,null,68,"ATLAS",85,6,3,"2026-11"],
  ["4700-B01-B","OXIDATION BLOWER B","Lobe Blower","CPL",null,null,null,68,"PTT",3,6,3,"2026-07"],
  ["4700-B01-C","OXIDATION BLOWER C","Lobe Blower","CPL",null,null,null,68,"PTT",3,6,3,"2026-07"],
  ["4700-B01-D","OXIDATION BLOWER D","Lobe Blower","CPL",null,null,null,68,"PTT",3,6,3,"2026-07"],
  ["4700-B02-A","Screw blower (1)","Screw Blower","CPL",null,null,null,68,"ATLAS",20,24,12,"2026-11"],
  ["4700-B02-2","Screw blower","Screw Blower","CPL",null,null,null,68,"ATLAS",20,24,12,"2026-11"],
  ["4700-S03","CENTRIFUGE DEHYDRATOR","Decanter Separator","CPL",null,null,null,10,"SHELL",2,6,3,"2026-07"],
  ["4710-S03-M1","Multi disk screw dehydrator","Decanter Separator","CPL",null,null,null,320,"MOBIL",12.5,12,6,"2026-11"],
  ["4700-P01-A","ORGANIC INFLUENT FEEDING PUMP A","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.4,6,3,"2026-07"],
  ["4700-P01-B","ORGANIC INFLUENT FEEDING PUMP B","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.4,6,3,"2026-07"],
  ["4700-P01-C","ORGANIC WASTE WATER PUMP","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.4,6,3,"2026-07"],
  ["4700-P02-A","SLUDGE RETURN PUMP","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.5,6,3,"2026-07"],
  ["4700-P02-B","SLUDGE RETURN PUMP","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.5,6,3,"2026-07"],
  ["4700-P05-A","SLUDGE DISCHARGE PUMP","Centrifugal Pump","CPL",null,null,null,46,"PTT",0.6,6,3,"2026-07"],
  ["4700-P05-B","SLUDGE DISCHARGE PUMP","Centrifugal Pump","CPL",null,null,null,46,"PTT",0.6,6,3,"2026-07"],
  ["4700-P06-A","FILTERING FEED PUMP","Centrifugal Pump","CPL",null,null,null,46,"PTT",1,6,3,"2026-07"],
  ["4700-P06-B","FILTERING FEED PUMP","Centrifugal Pump","CPL",null,null,null,46,"PTT",1,6,3,"2026-07"],
  ["4700-P06-C","FILTERING FEED PUMP","Centrifugal Pump","CPL",null,null,null,46,"PTT",1,6,3,"2026-07"],
  ["4700-P09-A","TURBID WATER FEEDING PUMP","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.3,6,3,"2026-07"],
  ["4700-P09-B","TURBID WATER FEEDING PUMP","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.3,6,3,"2026-07"],
  ["4700-P10-A","ACIDIC/ALKALINE FEEDING PUMP","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.5,6,3,"2026-07"],
  ["4700-P10-B","ORGANIC INFLUENT FEEDING PUMP","Centrifugal Pump","CPL",null,null,null,100,"MOBIL",0.2,6,3,"2026-07"],
  ["4700-P11","Oily waste pump","Centrifugal Pump","CPL",null,null,null,46,"PTT",0.3,6,3,"2026-07"],
  ["4700-P12-A","SUMP PUMP","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.3,6,3,"2026-07"],
  ["4700-P12-B","SUMP PUMP","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.3,6,3,"2026-07"],
  ["4700-P13","SLUGE PUMP","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.9,6,3,"2026-07"],
  ["4700-P14","SLURRY PUMP","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.3,6,3,"2026-07"],
  ["4700-P17","H2SO4 PUMP FOR AMMONIA SCRUBBING","Reciprocating Pump","CPL",null,null,null,220,"MOBIL",0.2,6,3,"2026-07"],
  ["4700-P18-A","H3P04 PUMP","Reciprocating Pump","CPL",null,null,null,220,"MOBIL",0.2,6,3,"2026-07"],
  ["4700-P18-B","H3P04 PUMP","Reciprocating Pump","CPL",null,null,null,220,"MOBIL",0.2,6,3,"2026-07"],
  ["4700-P21-A","NAOH PUMP","Reciprocating Pump","CPL",null,null,null,220,"MOBIL",0.2,6,3,"2026-07"],
  ["4700-P21-B","NAOH PUMP","Reciprocating Pump","CPL",null,null,null,220,"MOBIL",0.2,6,3,"2026-07"],
  ["4700-P22","NAOH PUMP","Reciprocating Pump","CPL",null,null,null,220,"MOBIL",0.2,6,3,"2026-07"],
  ["4700-P24-A","AI2(SO4)3 PUMP","Reciprocating Pump","CPL",null,null,null,220,"MOBIL",0.2,6,3,"2026-07"],
  ["4700-P24-B","AI2(SO4)3 PUMP","Reciprocating Pump","CPL",null,null,null,220,"MOBIL",0.2,6,3,"2026-07"],
  ["4700-P25-A","POLYMER PUMP FOR FLOCCULATION","Reciprocating Pump","CPL",null,null,null,220,"MOBIL",0.2,6,3,"2026-07"],
  ["4700-P27-A","POLYMER PUMP FOR DEHYDRATION","Reciprocating Pump","CPL",null,null,null,220,"MOBIL",0.2,6,3,"2026-07"],
  ["4700-P27-B","POLYMER PUMP FOR DEHYDRATION","Reciprocating Pump","CPL",null,null,null,220,"MOBIL",0.2,6,3,"2026-07"],
  ["4700-P28-A","ACIDIC/ALKALINE LIFTING PUMP","Centrifugal Pump","CPL",null,null,null,46,"PTT",0.4,6,3,"2026-07"],
  ["4700-P29-A","DILY LIFTING PUMP","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.3,6,3,"2026-07"],
  ["4700-P29-B","DILY LIFTING PUMP","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.3,6,3,"2026-07"],
  ["4700-P30","H2SO4 PUMP FOR AMMONIA SCRUBBING","Other","CPL",null,null,null,220,"MOBIL",0.2,6,3,"2026-07"],
  ["4700-P32-A","ORGANIC WASTE TRANSFER PUMP A","Centrifugal Pump","CPL",null,null,null,46,"PTT",0.4,6,3,"2026-07"],
  ["4700-P32-B","ORGANIC WASTE TRANSFER PUMP B","Centrifugal Pump","CPL",null,null,null,46,"PTT",0.4,6,3,"2026-07"],
  ["4700-P39","Abnormal Waste Water Tank Pump","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.75,6,3,"2026-07"],
  ["4700-P40","UFA waste water pump","Centrifugal Pump","CPL",null,null,null,32,"PTT",0.75,6,3,"2026-07"],
  ["4700-V05-A1","SLUDGE SEPARATION SCRAPPER","Scrapper Agitator","CPL",null,null,null,220,"MOBIL",90,12,6,"2026-07"],
  ["4700-V07-A1","Coagulation Mixer 1","Other","CPL",null,null,null,0,null,0,0,6,"2026-11"],
  ["4700-V07-A2","COAGULATION MIXER-2","Mechanical Agitator","CPL",null,null,null,220,"MOBIL",1,12,6,"2026-07"],
  ["4700-V07-A3","FLOCCULATION MIXER-1","Mechanical Agitator","CPL",null,null,null,220,"MOBIL",9,12,6,"2026-07"],
  ["4700-V07-A4","FLOCCULATION MIXER-2","Mechanical Agitator","CPL",null,null,null,220,"MOBIL",9,12,6,"2026-07"],
  ["4700-V08-A1","SEDIMENTATION SCRAPPER","Scrapper Agitator","CPL",null,null,null,220,"MOBIL",90,12,6,"2026-07"],
  ["4700-V17-A1","SLUDGE THICKENER AGITATOR","Mechanical Agitator","CPL",null,null,null,220,"MOBIL",9.5,12,6,"2026-07"],
  ["4700-V26A1-A","AI2(SO4)3 MIXER","Mechanical Agitator","CPL",null,null,null,220,"MOBIL",0.8,12,6,"2026-07"],
  ["4700-V26A1-B","AI2(SO4)3 MIXER","Mechanical Agitator","CPL",null,null,null,220,"MOBIL",0.8,12,6,"2026-07"],
  ["4710-B01-C","OXIDATION BLOWER C","Blower/Fan","CPL",null,null,null,100,"MOBIL",4.5,6,3,"2026-07"],
  ["4710-B02-A","PLANT AIR COMPRESSOR","Screw Compressor","CPL",null,null,null,68,"ATLAS",20,24,12,"2026-11"],
  ["4710-B02-C","PLANT AIR COMPRESSOR","Screw Compressor","CPL",null,null,null,68,"ATLAS",20,24,12,"2026-11"],
  ["4710-B02-D","PLANT AIR COMPRESSOR","Screw Compressor","CPL",null,null,null,68,"ATLAS",20,24,12,"2026-11"],
  ["4710-B02-E","PLANT AIR COMPRESSOR","Screw Compressor","CPL",null,null,null,68,"ATLAS",20,24,12,"2026-11"],
  ["4710-P02-A","SLUDGE RETURN PUMP A (AUTO RUN)","Centrifugal Pump","CPL",null,null,null,46,"PTT",0.4,6,3,"2026-07"],
  ["4710-P02-B","SLUDGE RETURN PUMP B (AUTO RUN)","Centrifugal Pump","CPL",null,null,null,46,"PTT",0.4,6,3,"2026-07"],
  ["4710-P27","POLYMER PUMP FOR DEHYDRATION","Reciprocating Pump","CPL",null,null,null,220,"MOBIL",0.2,6,3,"2026-07"],
  ["4710-V02-A1","NEUTRALIZATION TANK AGITATOR","Mechanical Agitator","CPL",null,null,null,220,"MOBIL",2,6,3,"2026-07"],
  ["4710-V05-A1","SLUDGE SEPARATION TANK AGITATOR","Scrapper Agitator","CPL",null,null,null,220,"MOBIL",15,6,3,"2026-07"],
  ["4750-P01","STORM DRAIN PUMP NO.1","Centrifugal Pump","CPL",null,null,null,68,"PTT",2.5,6,3,"2026-07"],
  ["4750-P02","STORM DRAIN PUMP NO.2","Centrifugal Pump","CPL",null,null,null,68,"PTT",2.5,6,3,"2026-07"],
  ["4750-P03","STORM DRAIN PUMP NO.3","Centrifugal Pump","CPL",null,null,null,68,"PTT",2.5,6,3,"2026-07"],
  ["4750-P04","STORM DRAIN PUMP NO.4","Centrifugal Pump","CPL",null,null,null,68,"PTT",2.5,6,3,"2026-07"],
  ["4750-P05","STORM DRAIN PUMP NO.5","Centrifugal Pump","CPL",null,null,null,68,"PTT",2.5,6,3,"2026-07"],
  ["4750-P06","STORM DRAIN PUMP NO.6","Centrifugal Pump","CPL",null,null,null,68,"PTT",2.5,6,3,"2026-07"],
  ["5650-P01","ASML LOADING PUMP","Centrifugal Pump","CPL",null,null,null,46,"PTT",0.4,6,3,"2026-07"],
  ["5700-P01","Raining Recover Pump","Centrifugal Pump","CPL",null,null,null,68,"PTT",0.4,6,3,"2026-07"],
  ["4100-P01","CHEMICAL PUMP (AUTO RUN)","Centrifugal Pump","CPL",null,null,null,46,"ENEOS",0.5,6,3,"2026-11"],
  ["4100-P02","CHEMICAL PUMP (AUTO RUN)","Centrifugal Pump","CPL",null,null,null,46,"PTT",0.5,12,6,"2026-07"],
  ["4100-P03","CHEMICAL PUMP (AUTO RUN)","Centrifugal Pump","CPL",null,null,null,46,"ENEOS",0.5,6,3,"2026-11"],
  ["4100-XV-A01","OIL AGITATOR No.1","Other","CPL",null,null,null,320,"SHELL",2,12,6,"2026-11"],
  ["4100-XV-A02","OIL AGITATOR No.2","Other","CPL",null,null,null,320,"SHELL",2,12,6,"2026-11"],
  ["4110-B02","NO.2 DEODORANT SULPHUR BLOWER","Lobe Blower","CPL",null,null,null,68,"PTT",3,12,6,"2026-07"],
  ["4110-P04","CONDENSATE TRANSAFER PUMP","Centrifugal Pump","CPL",null,null,null,46,"PTT",0.4,6,3,"2026-07"],
  ["4110-P06","SCRUBBING PUMP","Centrifugal Pump","CPL",null,null,null,46,"PTT",0.4,6,3,"2026-07"],
  ["4110-P08-A","SCRUBBER RECIRCULATION PUMP A","Centrifugal Pump","CPL",null,null,null,68,"MOBIL",0.35,6,3,"2026-11"],
  ["4110-P09-A","SODIUM HYOXIDE(NaOH) METERING PUMP A","Metering Pump","CPL",null,null,null,220,"MOBIL",0.65,6,3,"2026-07"],
  ["4110-P09-B","SODIUM HYOXIDE(NaOH) METERING PUMP B","Metering Pump","CPL",null,null,null,220,"MOBIL",0.65,6,3,"2026-07"],
  ["4110-P10-B","SODIUM HYOXIDE(NaOH) METERING PUMP B","Metering Pump","CPL",null,null,null,220,"MOBIL",2.8,6,3,"2026-07"],
  ["4120-P01-A-T1","BFW PUMP TURBINE","Steam Turbine","CPL",null,null,null,46,"ENEOS",6.8,12,6,"2026-11"],
  ["4120-P01-B","BFW PUMP","Radial Split Pump","CPL",null,null,null,46,"ENEOS",0.8,6,3,"2026-11"],
  ["4120-U01-P1-A","HYDRAZINE FEED PUMP","Reciprocating Pump","CPL",null,null,null,68,"PTT",4.5,12,6,"2026-07"],
  ["4120-U01-P1-B","HYDRAZINE FEED PUMP","Reciprocating Pump","CPL",null,null,null,68,"PTT",4.5,12,6,"2026-07"],
  ["4120-U02-P1-A","PHOSPHATE FEED PUMP","Reciprocating Pump","CPL",null,null,null,68,"PTT",4.5,12,6,"2026-07"],
  ["4120-U02-P1-B","PHOSPHATE FEED PUMP","Reciprocating Pump","CPL",null,null,null,68,"PTT",4.5,12,6,"2026-07"],
  ["4140-B01-T1 (oil system)","AIR BLOWER TURBINE (oil system)","Steam Turbine","CPL",null,null,null,32,"ENEOS",700,36,18,"2026-11"],
  ["4140-B01-T1 (Gloverner)","AIR BLOWER TURBINE (Gloverner)","Steam Turbine","CPL",null,null,null,46,"ENEOS",2,36,18,"2026-11"],
  ["4140-B04","EXHAUST GAS BLOWER","Blower/Fan","CPL",null,null,null,46,"ENEOS",0.8,6,3,"2026-11"],
  ["4140-B05","COOLED AIR BLOWER","Blower/Fan","CPL",null,null,null,46,"ENEOS",0.8,6,3,"2026-11"],
  ["4140-P06","DRAIN ACID PUMP","Centrifugal Pump","CPL",null,null,null,46,"PTT",0.4,12,6,"2026-07"],
  ["4140-P07-A","PRODUCT ACID TRANSFER PUMP","Centrifugal Pump","CPL",null,null,null,46,"PTT",0.4,6,3,"2026-07"],
  ["4140-P07-B","PRODUCT ACID TRANSFER PUMP","Centrifugal Pump","CPL",null,null,null,46,"PTT",0.4,6,3,"2026-07"],
  ["4140-P08-A","OLEUM TRANSFER PUMP","Centrifugal Pump","CPL",null,null,null,46,"PTT",0.4,6,3,"2026-07"],
  ["4140-P08-B","OLEUM TRANSFER PUMP","Centrifugal Pump","CPL",null,null,null,46,"PTT",0.4,6,3,"2026-07"],
  ["4140-P09-A","SI CIRCULATION PUMP","Centrifugal Pump","CPL",null,null,null,46,"PTT",0.4,6,3,"2026-07"],
  ["4140-P09-B","SI CIRCULATION PUMP","Centrifugal Pump","CPL",null,null,null,46,"PTT",0.4,6,3,"2026-07"],
  ["4140-P10-A","DW CIRCULATION PUMP","Centrifugal Pump","CPL",null,null,null,46,"PTT",0.4,6,3,"2026-07"],
  ["4140-P10-B","DW CIRCULATION PUMP","Centrifugal Pump","CPL",null,null,null,46,"PTT",0.4,6,3,"2026-07"],
  ["4140-P12-C","CHILLER WATER PUMP","Centrifugal Pump","CPL",null,null,null,46,"PTT",0.4,6,3,"2026-07"],
  ["4140-U02-P05","VACUUM PUMP","Pump","CPL",null,null,null,100,"SHELL",1.8,2,1,"2026-07"],
  ["4160-P01-A","RECOVERED SC DISTRIBUTION PUMP","Centrifugal Pump","CPL",null,null,null,46,"PTT",0.6,6,3,"2026-07"],
  ["4160-P01-B","RECOVERED SC DISTRIBUTION PUMP","Centrifugal Pump","CPL",null,null,null,46,"PTT",0.6,6,3,"2026-07"],
  ["1390-U1-Z1","EMPTY BAG PRESSER","Hydraulic Unit","CPL",null,null,null,46,"ENEOS",60,12,6,"2026-11"],
  ["1390-U1-H2","DEPALLETIZER","Hydraulic Unit","CPL",null,null,null,46,"ENEOS",0,12,6,"2026-11"],
  ["01-B01-A","ADSORBER BLOWER A","Blower/Fan","TSL",null,null,null,68,"MOBIL",2,6,3,"2026-07"],
  ["01-B01-B","ADSORBER BLOWER B","Blower/Fan","TSL",null,null,null,68,"MOBIL",2,6,3,"2026-07"],
  ["01-B01-C","ADSORBER BLOWER C","Blower/Fan","TSL",null,null,null,68,"MOBIL",2,6,3,"2026-07"],
  ["02-A02","SKIMMING BASIN AGITATOR","Mechanical Agitator","TSL",null,null,null,100,"MOBIL",4,12,6,"2026-07"],
  ["02-P01A","CRUMB SEPARATOR PUMP A","Centrifugal Pump","TSL",null,null,null,68,"PTT",1,6,3,"2026-07"],
  ["02-P01B","CRUMB SEPARATOR PUMP B","Centrifugal Pump","TSL",null,null,null,68,"PTT",1,6,3,"2026-07"],
  ["02-P02A","SLUDGE TRANSFER PUMP A","Centrifugal Pump","TSL",null,null,null,68,"PTT",1,6,3,"2026-07"],
  ["02-P02B","SLUDGE TRANSFER PUMP B","Centrifugal Pump","TSL",null,null,null,68,"PTT",1,6,3,"2026-07"],
  ["02-P04 (Air Rervo Unit)","H2SO4 PUMP (Air Rervo Unit)","Centrifugal Pump","TSL",null,null,null,32,"PTT",0.2,12,6,"2026-07"],
  ["02-P04 (Crank Case)","H2SO4 PUMP (Crank Case)","Centrifugal Pump","TSL",null,null,null,46,"PTT",2,12,6,"2026-07"],
  ["02-P05A","WASTE WATER RECOVERY PUMP A","Centrifugal Pump","TSL",null,null,null,32,"PTT",0.6,6,3,"2026-07"],
  ["02-P05B","WASTE WATER RECOVERY PUMP A","Centrifugal Pump","TSL",null,null,null,32,"PTT",0.6,6,3,"2026-07"],
  ["02-P06","WASTE WATER TRANSFER PUMP","Centrifugal Pump","TSL",null,null,null,32,"PTT",0.6,6,3,"2026-07"],
  ["02-P07","WASTE WATER TRANSFER PUMP","Centrifugal Pump","TSL",null,null,null,32,"PTT",0.6,6,3,"2026-07"],
  ["02-P08-A","WASTE WATER PUMP A","Centrifugal Pump","TSL",null,null,null,68,"PTT",1,6,3,"2026-07"],
  ["02-P08-B","WASTE WATER PUMP B","Centrifugal Pump","TSL",null,null,null,46,"PTT",1.9,6,3,"2026-07"],
  ["02-Q02-M01","Sludge Conveyor (1.5 KW บน)","Motor Gearbox","TSL",null,null,null,220,"MOBIL",2.5,12,6,"2026-07"],
  ["02-Q02-M02","Sludge Conveyor (0.37 KW ล่าง)","Motor Gearbox","TSL",null,null,null,220,"MOBIL",1.5,12,6,"2026-07"],
  ["02-S02-1-M01","Sludge Dehydrator (1.5 KW)","Motor Gearbox","TSL",null,null,null,220,"MOBIL",11,12,6,"2026-07"],
  ["02-S02-1-M02","Sludge Dehydrator (1.5 KW)","Motor Gearbox","TSL",null,null,null,220,"MOBIL",11,12,6,"2026-07"],
  ["02-S02-1-M03","Sludge Dehydrator (1.5 KW)","Motor Gearbox","TSL",null,null,null,220,"MOBIL",11,12,6,"2026-07"],
  ["02-U01-P01-M01","COAGULANT A SOLUTION PUMP MOTOR","Reciprocating Pump","TSL",null,null,null,100,"MOBIL",5.5,12,6,"2026-07"],
  ["02-U02-A01-M01","COAGULANT A UNIT","Motor Gearbox","TSL",null,null,null,320,"MOBIL",1.5,12,6,"2026-07"],
  ["02-U02-P01","COAGULANT B UNIT","Motor Gearbox","TSL",null,null,null,320,"MOBIL",1.5,12,6,"2026-07"],
  ["Water jet no. 1","Water jet","Other","TSL",null,null,null,0,"SHELL (SAE 15W-40)",2.5,3,1,"2026-07"],
  ["Water jet no. 2","Water jet","Other","TSL",null,null,null,0,"SHELL (SAE 15W-40)",2.5,3,1,"2026-07"],
  ["03-P01A","BRINE PUMP A","Centrifugal Pump","TSL",null,null,null,32,"PTT",2,6,3,"2026-07"],
  ["03-P01B","BRINE PUMP B","Centrifugal Pump","TSL",null,null,null,32,"PTT",2,6,3,"2026-07"],
  ["03-P01C","BRINE PUMP C","Centrifugal Pump","TSL",null,null,null,32,"PTT",2,6,3,"2026-07"],
  ["03-U01A","COMPRESSOR A","Compressor","TSL",null,null,null,68,"CP",800,12,6,"2026-07"],
  ["03-U01A-M1","COMPRESSOR A -MOTOR","Motor","TSL",null,null,null,32,"ENEOS",6,12,6,"2026-07"],
  ["03-U01B","COMPRESSOR B","Compressor","TSL",null,null,null,68,"CP",800,12,6,"2026-07"],
  ["03-U01B-M1","COMPRESSOR B -MOTOR","Motor","TSL",null,null,null,32,"ENEOS",6,12,6,"2026-07"],
  ["03-U01C","COMPRESSOR C","Compressor","TSL",null,null,null,46,"SHELL",1000,12,6,"2026-07"],
  ["03-U01C-M1","COMPRESSOR C -MOTOR","Motor","TSL",null,null,null,32,"ENEOS",6,12,6,"2026-07"],
  ["05-B11A","COOLING TOWER FAN","Blower/Fan","TSL",null,null,null,150,"MOBIL",40,12,6,"2026-07"],
  ["05-P01A","COOLING TOWER PUMP A","Axial Split Pump","TSL",null,null,null,68,"PTT",3.6,6,3,"2026-07"],
  ["05-P01B","COOLING TOWER PUMP B","Axial Split Pump","TSL",null,null,null,68,"PTT",3.6,6,3,"2026-07"],
  ["05-P01C","COOLING TOWER PUMP C","Axial Split Pump","TSL",null,null,null,68,"PTT",3.6,6,3,"2026-07"],
  ["05-P02A","PROCESS WATER PUMP A","Centrifugal Pump","TSL",null,null,null,32,"PTT",1.8,6,3,"2026-07"],
  ["05-P02B","PROCESS WATER PUMP B","Centrifugal Pump","TSL",null,null,null,32,"PTT",1.8,6,3,"2026-07"],
  ["05-P03A","COOLING WATER BOOSTER PUMP A","Centrifugal Pump","TSL",null,null,null,32,"PTT",4,6,3,"2026-07"],
  ["05-P03B","COOLING WATER BOOSTER PUMP B","Centrifugal Pump","TSL",null,null,null,32,"PTT",4,6,3,"2026-07"],
  ["05-P04A","DEMINRALIZED WATER BOOSTER PUMP A","Centrifugal Pump","TSL",null,null,null,32,"PTT",1.8,6,3,"2026-07"],
  ["05-P04B","DEMINRALIZED WATER BOOSTER PUMP B","Centrifugal Pump","TSL",null,null,null,32,"PTT",1.8,6,3,"2026-07"],
  ["05-P50A","H2S04 MEASURING PUMP A","Reciprocating Pump","TSL",null,null,null,150,"MOBIL",1,12,6,"2026-07"],
  ["05-P50B","H2S04 MEASURING PUMP B","Reciprocating Pump","TSL",null,null,null,150,"MOBIL",1,12,6,"2026-07"],
  ["05-P52A","PROCESS WATER SUPPLY PUMP A","Centrifugal Pump","TSL",null,null,null,32,"PTT",0.5,6,3,"2026-07"],
  ["05-P52B","PROCESS WATER SUPPLY PUMP B","Centrifugal Pump","TSL",null,null,null,32,"PTT",0.5,6,3,"2026-07"],
  ["06-K01A","COMPRESSOR A","Screw Compressor","TSL",null,null,null,68,"ATLAS",60,6,3,"2026-07"],
  ["06-K01B","COMPRESSOR B","Screw Compressor","TSL",null,null,null,68,"ATLAS",60,6,3,"2026-07"],
  ["09-K01A","NITROGEN COMPRESSOR A","Reciprocating Compressor","TSL",null,null,null,100,"MOBIL",5,12,6,"2026-07"],
  ["09-K01B","NITROGEN COMPRESSOR B","Reciprocating Compressor","TSL",null,null,null,100,"MOBIL",5,12,6,"2026-07"],
  ["31-A02 (Gear Box)","M-2-MAKE-UP TANK AGITATOR (Gear Box)","Mechanical Agitator","TSL",null,null,null,460,"MOBIL",2,12,6,"2026-07"],
  ["31-A02 (Oil Tank)","M-2-MAKE-UP TANK AGITATOR (Oil Tank)","Mechanical Agitator","TSL",null,null,null,32,"ENEOS",130,12,6,"2026-07"],
  ["31-A03 (Gear Box)","TBC MAKE-UP TANK AGITATOR (Gear Box)","Mechanical Agitator","TSL",null,null,null,460,"MOBIL",2,12,6,"2026-07"],
  ["31-A03 (Mechanical Seal)","TBC MAKE-UP TANK AGITATOR (Mechanical Seal)","Mechanical Agitator","TSL",null,null,null,32,"MOBIL",4.5,12,6,"2026-07"],
  ["31-A04","C-1 MAKE-UP TANK AGITATOR","Mechanical Agitator","TSL",null,null,null,32,"MOBIL",4.5,12,6,"2026-07"],
  ["31-A05 (M/C)","AO-MAKE UP TANK AGITATOR (M/C)","M/C","TSL",null,null,null,32,"MOBIL",4.5,12,6,"2026-07"],
  ["31-A05 (Cyclo Reduce)","AO-MAKE UP TANK AGITATOR (Cyclo Reduce)","M/C","TSL",null,null,null,100,"MOBIL",8,12,6,"2026-07"],
  ["31-P05A (Replenishing Cambe)","DEAC FEED PUMP A (Replenishing Cambe)","Metering Pump","TSL",null,null,null,10,"SHELL",2.2,12,6,"2026-07"],
  ["31-P05A (Air Rervo Unit)","DEAC FEED PUMP A (Air Rervo Unit)","Metering Pump","TSL",null,null,null,32,"ENEOS",1.3,12,6,"2026-07"],
  ["31-P05A (Crank Case)","DEAC FEED PUMP A (Crank Case)","Metering Pump","TSL",null,null,null,150,"MOBIL",5.5,12,6,"2026-07"],
  ["31-P05B (Replenishing Cambe)","DEAC FEED PUMP B (Replenishing Cambe)","Metering Pump","TSL",null,null,null,10,"SHELL",2.2,12,6,"2026-07"],
  ["31-P05B (Air Rervo Unit)","DEAC FEED PUMP B (Air Rervo Unit)","Metering Pump","TSL",null,null,null,32,"ENEOS",1.3,12,6,"2026-07"],
  ["31-P05B (Crank Case)","DEAC FEED PUMP B (Crank Case)","Metering Pump","TSL",null,null,null,150,"MOBIL",5.5,12,6,"2026-07"],
  ["31-P11A (Replenishing Cambe)","M-1 FEED PUMP A (Replenishing Cambe)","Reciprocating Pump","TSL",null,null,null,10,"SHELL",0.8,12,6,"2026-07"],
  ["31-P11A (Air Rervo Unit)","M-1 FEED PUMP A (Air Rervo Unit)","Reciprocating Pump","TSL",null,null,null,32,"ENEOS",0.5,12,6,"2026-07"],
  ["31-P11A (Crank Case)","M-1 FEED PUMP A (Crank Case)","Reciprocating Pump","TSL",null,null,null,150,"MOBIL",2.5,12,6,"2026-07"],
  ["31-P11B (Replenishing Cambe)","M-1 FEED PUMP B (Replenishing Cambe)","Reciprocating Pump","TSL",null,null,null,10,"SHELL",0.5,12,6,"2026-07"],
  ["31-P11B (Air Rervo Unit)","M-1 FEED PUMP B (Air Rervo Unit)","Reciprocating Pump","TSL",null,null,null,32,"ENEOS",0.5,12,6,"2026-07"],
  ["31-P11B (Crank Case)","M-1 FEED PUMP B (Crank Case)","Reciprocating Pump","TSL",null,null,null,150,"MOBIL",2.5,12,6,"2026-07"],
  ["31-P12A","DU-3 FEED PUMP A","Reciprocating Pump","TSL",null,null,null,150,"MOBIL",1,12,6,"2026-07"],
  ["31-P12B","DU-3 FEED PUMP B","Reciprocating Pump","TSL",null,null,null,150,"MOBIL",1,12,6,"2026-07"],
  ["31-P12C","DU-3 FEED PUMP B","Reciprocating Pump","TSL",null,null,null,150,"MOBIL",1,12,6,"2026-07"],
  ["31-P14 (Replenishing Cambe)","DRYER COLUMN TBC FEED PUMP (Replenishing Cambe)","Reciprocating Pump","TSL",null,null,null,10,"SHELL",0.1,12,6,"2026-07"],
  ["31-P14 (Crank Case)","DRYER COLUMN TBC FEED PUMP (Crank Case)","Reciprocating Pump","TSL",null,null,null,150,"MOBIL",1.5,12,6,"2026-07"],
  ["31-P15 (Replenishing Cambe)","BUTADIENE COLUMN TBC FEED PUMP (Replenishing Cambe)","Reciprocating Pump","TSL",null,null,null,10,"SHELL",0.1,12,6,"2026-07"],
  ["31-P15 (Crank Case)","BUTADIENE COLUMN TBC FEED PUMP (Crank Case)","Reciprocating Pump","TSL",null,null,null,150,"MOBIL",1.5,12,6,"2026-07"],
  ["31-P19A","RAW BUTADIENE PUMP A","Centrifugal Pump","TSL",null,null,null,32,"PTT",15,12,6,"2026-07"],
  ["31-P19B","RAW BUTADIENE PUMP B","Centrifugal Pump","TSL",null,null,null,32,"PTT",15,12,6,"2026-07"],
  ["31-P21-A","C4 DISCHARGE PUMP (AUTO RUN)","Metering Pump","TSL",null,null,null,220,"MOBIL",3,6,3,"2026-07"],
  ["31-P21-B","C4 DISCHARGE PUMP (AUTO RUN)","Metering Pump","TSL",null,null,null,220,"MOBIL",3,6,3,"2026-07"],
  ["31-P22-A (Crank gear oil)","M-1 FEED PUMP -A (Crank gear oil)","Other","TSL",null,null,null,460,"MOBIL",10,6,3,"2026-07"],
  ["31-P22-A (hydraulic oil)","M-1 FEED PUMP -A (hydraulic oil)","Other","TSL",null,null,null,32,"ENEOS",2.8,6,3,"2026-07"],
  ["31-P22-B (Air Rervo Unit)","M-1 FEED PUMP -B (Air Rervo Unit)","Other","TSL",null,null,null,460,"MOBIL",10,6,3,"2026-07"],
  ["31-P22-B (Crank Case)","M-1 FEED PUMP -B (Crank Case)","Other","TSL",null,null,null,32,"ENEOS",2.8,6,3,"2026-07"],
  ["31-P52-A (Crank case)","TEA FEED PUMP A (Crank case)","Reciprocating Pump","TSL",null,null,null,150,"MOBIL",7,12,6,"2026-07"],
  ["31-P52-A (Displacement chamber)","TEA FEED PUMP A (Displacement chamber)","Reciprocating Pump","TSL",null,null,null,46,"ENEOS",0.53,12,6,"2026-07"],
  ["31-P52-B (Crank case)","TEA FEED PUMP B (Crank case)","Reciprocating Pump","TSL",null,null,null,150,"MOBIL",7,12,6,"2026-07"],
  ["31-P52-B (Displacement chamber)","TEA FEED PUMP B (Displacement chamber)","Reciprocating Pump","TSL",null,null,null,46,"ENEOS",0.53,12,6,"2026-07"],
  ["31-P54-A","HIGH PRESSURE CATALYST WATER FEED PUMP A","Other","TSL",null,null,null,150,"MOBIL",1,12,6,"2026-07"],
  ["31-P54-B","HIGH PRESSURE CATALYST WATER FEED PUMP A","Other","TSL",null,null,null,150,"MOBIL",1,12,6,"2026-07"],
  ["31-P56-A (Replenishing Cambe)","TEA/DEAC MIXER FEED PUMP A (Replenishing Cambe)","Reciprocating Pump","TSL",null,null,null,10,"SHELL",0.8,12,6,"2026-07"],
  ["31-P56-A (Air Rervo Unit)","TEA/DEAC MIXER FEED PUMP A (Air Rervo Unit)","Reciprocating Pump","TSL",null,null,null,32,"PTT",0.53,12,6,"2026-07"],
  ["31-P56-A (Crank Case)","TEA/DEAC MIXER FEED PUMP A (Crank Case)","Reciprocating Pump","TSL",null,null,null,150,"MOBIL",2.5,12,6,"2026-07"],
  ["31-P56-B (Replenishing Cambe)","TEA/DEAC MIXER FEED PUMP B (Replenishing Cambe)","Reciprocating Pump","TSL",null,null,null,10,"SHELL",0.8,12,6,"2026-07"],
  ["31-P56-B (Air Rervo Unit)","TEA/DEAC MIXER FEED PUMP B (Air Rervo Unit)","Reciprocating Pump","TSL",null,null,null,32,"PTT",0.53,12,6,"2026-07"],
  ["31-P56-B (Crank Case)","TEA/DEAC MIXER FEED PUMP B (Crank Case)","Reciprocating Pump","TSL",null,null,null,150,"MOBIL",2.5,12,6,"2026-07"],
  ["31-P59","CM Flash TBC Feed Pump","Reciprocating Pump","TSL",null,null,null,150,"MOBIL",1,6,3,"2026-07"],
  ["32-A01","CATALYST AGING TANK AGITATOR","Mechanical Agitator","TSL",null,null,null,100,"MOBIL",1.5,12,6,"2026-07"],
  ["32-A01-M2","CATALYST AGING TANK AGITATOR","Oil Unit","TSL",null,null,null,32,"ENEOS",80,12,6,"2026-07"],
  ["32-A02","NO.1 REACTOR AGITATOR","Mechanical Agitator","TSL",null,null,null,320,"MOBIL",40,12,6,"2026-07"],
  ["32-A03","NO.2 REACTOR AGITATOR","Mechanical Agitator","TSL",null,null,null,320,"MOBIL",40,12,6,"2026-07"],
  ["32-A04","NO.3 REACTOR AGITATOR","Mechanical Agitator","TSL",null,null,null,320,"MOBIL",40,12,6,"2026-07"],
  ["32-A05A","SHORT STOP TANK AGITATOR A","Mechanical Agitator","TSL",null,null,null,32,"MOBIL",4.5,12,6,"2026-07"],
  ["32-A05B","SHORT STOP TANK AGITATOR B","Mechanical Agitator","TSL",null,null,null,32,"MOBIL",4.5,12,6,"2026-07"],
  ["32-A07","WATER DISSOLVING TANK AGITATOR","Mechanical Agitator","TSL",null,null,null,100,"MOBIL",2,12,6,"2026-07"],
  ["32-A07-M2","WATER DISSOLVING TANK AGITATOR","Oil Unit","TSL",null,null,null,32,"ENEOS",80,12,6,"2026-07"],
  ["32-A08","N0.4 REACTOR AGITATOR","Mechanical Agitator","TSL",null,null,null,320,"MOBIL",40,12,6,"2026-07"],
  ["32-A51 (Tank oil)","DEAC/TEA MIXER (Tank oil)","Mechanical Agitator","TSL",null,null,null,32,"ENEOS",80,12,6,"2026-07"],
  ["32-A51 (Reducer Gear)","DEAC/TEA MIXER (Reducer Gear)","Mechanical Agitator","TSL",null,null,null,150,"MOBIL",2.7,6,3,"2026-07"],
  ["32-A52","TEA WATER DISSOLVING TANK AGITATOR","Mechanical Agitator","TSL",null,null,null,32,"MOBIL",2.6,12,6,"2026-07"],
  ["32-A53 (Mechanical Seal)","TEA AGING TANK AGITATOR (Mechanical Seal)","Mechanical Agitator","TSL",null,null,null,32,"MOBIL",2.6,12,6,"2026-07"],
  ["32-A53 (Cyclo Reduce)","TEA AGING TANK AGITATOR (Cyclo Reduce)","Mechanical Agitator","TSL",null,null,null,220,"MOBIL",2,12,6,"2026-07"],
  ["32-P01A (PM Oil Replacement)","FEED BLEND PUMP (PM Oil Replacement)","Mechanical Agitator","TSL",null,null,null,46,"PTT",0.4,6,3,"2026-07"],
  ["32-P01A (Oil Pot)","FEED BLEND PUMP (Oil Pot)","Mechanical Agitator","TSL",null,null,null,10,"SHELL",10,6,3,"2026-07"],
  ["32-P01B (Bearing Housing)","FEED BLEND PUMP (Bearing Housing)","Mechanical Agitator","TSL",null,null,null,68,"ENEOS",0.8,6,3,"2026-07"],
  ["32-P01B (Oil Pot)","FEED BLEND PUMP (Oil Pot)","Mechanical Agitator","TSL",null,null,null,10,"SHELL",9,6,3,"2026-07"],
  ["32-P03A","DRY FEED BLEND PUMP A","Centrifugal Pump","TSL",null,null,null,32,"PTT",9.8,6,3,"2026-07"],
  ["32-P03B","DRY FEED BLEND PUMP B","Centrifugal Pump","TSL",null,null,null,32,"PTT",9.8,6,3,"2026-07"],
  ["32-P04A","REACTOR BRINE CIRCULATION PUMP A","Centrifugal Pump","TSL",null,null,null,32,"PTT",1.8,6,3,"2026-07"],
  ["32-P04B","REACTOR BRINE CIRCULATION PUMP B","Centrifugal Pump","TSL",null,null,null,32,"PTT",1.8,6,3,"2026-07"],
  ["32-P08A","Dryer column condensate A","Centrifugal Pump","TSL",null,null,null,46,"PTT",0.6,6,3,"2026-07"],
  ["32-P08B","Dryer column condensate B","Centrifugal Pump","TSL",null,null,null,46,"PTT",0.6,6,3,"2026-07"],
  ["32-P51-A","MONOMER SHOT PUMP A","Centrifugal Pump","TSL",null,null,null,32,"PTT",14.8,12,6,"2026-07"],
  ["32-P51-B","MONOMER SHOT PUMP B","Centrifugal Pump","TSL",null,null,null,32,"PTT",14.8,12,6,"2026-07"],
  ["32-U01","REACTOR AGITATOR SEAL OIL UNIT","Oil Unit","TSL",null,null,null,46,"MOBIL",380,12,6,"2026-07"],
  ["33-A01A (Cyclo drive gear)","CEMENT SURGE TANK AGITATOR A (Cyclo drive gear)","Mechanical Agitator","TSL",null,null,null,100,"MOBIL",12,12,6,"2026-07"],
  ["33-A01A (Oil pot)","CEMENT SURGE TANK AGITATOR A (Oil pot)","Mechanical Agitator","TSL",null,null,null,32,"MOBIL",2.6,12,6,"2026-07"],
  ["33-A01B (Cyclo drive gear)","CEMENT SURGE TANK AGITATOR B (Cyclo drive gear)","Mechanical Agitator","TSL",null,null,null,100,"MOBIL",12,12,6,"2026-07"],
  ["33-A01B (Oil pot)","CEMENT SURGE TANK AGITATOR B (Oil pot)","Mechanical Agitator","TSL",null,null,null,32,"MOBIL",2.6,12,6,"2026-07"],
  ["33-A01C (Cyclo drive gear)","CEMENT SURGE TANK AGITATOR C (Cyclo drive gear)","Mechanical Agitator","TSL",null,null,null,150,"MOBIL",15,6,3,"2026-07"],
  ["33-A01C (M/C)","CEMENT SURGE TANK AGITATOR C (M/C)","Mechanical Agitator","TSL",null,null,null,32,"MOBIL",2.6,12,6,"2026-07"],
  ["33-A02-A","WATER ADDITION MIXER","Mechanical Agitator","TSL",null,null,null,32,"ENEOS",6,12,6,"2026-07"],
  ["33-A02-B","WATER ADDITION MIXER MOTOR B","Mechanical Agitator","TSL",null,null,null,32,"ENEOS",35,12,6,"2026-07"],
  ["33-A03A (Gearbox)","COAGULATOR AGITATOR IN COAGULATOR (Gearbox)","Mechanical Agitator","TSL",null,null,null,150,"MOBIL",110,12,6,"2026-07"],
  ["33-A03A (Oil Pot)","COAGULATOR AGITATOR IN COAGULATOR (Oil Pot)","Mechanical Agitator","TSL",null,null,null,32,"MOBIL",2.6,12,6,"2026-07"],
  ["33-A03B (Gearbox)","COAGULATOR AGITATOR IN COAGULATOR (Gearbox)","Mechanical Agitator","TSL",null,null,null,150,"MOBIL",110,12,6,"2026-07"],
  ["33-A03B (Oil pot)","COAGULATOR AGITATOR IN COAGULATOR (Oil pot)","Mechanical Agitator","TSL",null,null,null,32,"MOBIL",2.6,12,6,"2026-07"],
  ["33-A04 (Gearbox)","NO.1 STRIPPER AGITATOR (Gearbox)","Mechanical Agitator","TSL",null,null,null,150,"MOBIL",210,12,6,"2026-08"],
  ["33-A04 (Oil Pot)","NO.1 STRIPPER AGITATOR (Oil Pot)","Mechanical Agitator","TSL",null,null,null,32,"MOBIL",2.6,12,6,"2026-08"],
  ["33-A05 (Gearbox)","NO.2 STRIPPER AGITATOR (Gearbox)","Mechanical Agitator","TSL",null,null,null,150,"MOBIL",210,12,6,"2026-08"],
  ["33-A05 (Oil Pot)","NO.2 STRIPPER AGITATOR (Oil Pot)","Mechanical Agitator","TSL",null,null,null,32,"MOBIL",2.6,12,6,"2026-08"],
  ["33-A06 (Gearbox)","SLURRY SURGE TANK AGITATOR (Gearbox)","Mechanical Agitator","TSL",null,null,null,150,"MOBIL",40,12,6,"2026-08"],
  ["33-A06 (Oil Pot)","SLURRY SURGE TANK AGITATOR (Oil Pot)","Mechanical Agitator","TSL",null,null,null,32,"MOBIL",2.6,12,6,"2026-08"],
  ["33-A08","SCRAP SOLUTION TANK AGITATOR","Mechanical Agitator","TSL",null,null,null,32,"MOBIL",2.6,12,6,"2026-07"],
  ["33-A09-A","SCRAP COAGULATOR AGITATOR","Mechanical Agitator","TSL",null,null,null,32,"MOBIL",2.6,12,6,"2026-07"],
  ["33-A09-B (Gear Reduce)","Scrap Coagulator Agitator B (Gear Reduce)","Gearbox","TSL",null,null,null,220,"MOBIL",1.9,12,6,"2026-07"],
  ["33-A09-B (Oil Pot)","Scrap Coagulator Agitator B (Oil Pot)","Gearbox","TSL",null,null,null,32,"MOBIL",2.6,12,6,"2026-07"],
  ["33-A11","WATER MIXING AGITATOR","Mechanical Agitator","TSL",null,null,null,32,"ENEOS",80,12,6,"2026-07"],
  ["33-A12","HOT WATER RECOVERY TANK B AGITATOR","Mechanical Agitator","TSL",null,null,null,220,"MOBIL",2.6,12,6,"2026-07"],
  ["33-A51 (Cyclo Reduce)","REACTOR BLOW DOWM TANK AGITATOR (Cyclo Reduce)","Gearbox","TSL",null,null,null,100,"MOBIL",5.7,12,6,"2026-07"],
  ["33-A51 (Oil Pot)","REACTOR BLOW DOWM TANK AGITATOR (Oil Pot)","Gearbox","TSL",null,null,null,32,"MOBIL",2.6,12,6,"2026-07"],
  ["33-A55","FINE CRUMB MIXING TANK AGITATOR","Mechanical Agitator","TSL",null,null,null,220,"MOBIL",2.6,12,6,"2026-07"],
  ["33-P01A","CEMENT SURGE PUMP A","Centrifugal Pump","TSL",null,null,null,150,"MOBIL",2,12,6,"2026-07"],
  ["33-P01-M2A-LCS","PUMP A NO.2 SEAL OIL UNIT","Buffer Fluid Unit","TSL",null,null,null,10,"SHELL",100,12,6,null],
  ["33-P01B","CEMENT SURGE PUMP B","Centrifugal Pump","TSL",null,null,null,150,"MOBIL",2,12,6,"2026-07"],
  ["33-P01-M2C","PUMP B NO.1 SEAL OIL UNIT","Buffer Fluid Unit","TSL",null,null,null,32,"ENEOS",80,12,6,"2026-07"],
  ["33-P01-M2D","PUMP B NO.2 SEAL OIL UNIT","Buffer Fluid Unit","TSL",null,null,null,32,"ENEOS",80,12,6,"2026-07"],
  ["33-P01C","CEMENT SURGE PUMP C","Centrifugal Pump","TSL",null,null,null,150,"MOBIL",2,12,6,"2026-07"],
  ["33-P01-M2E","PUMP C NO.1 SEAL OIL UNIT","Buffer Fluid Unit","TSL",null,null,null,32,"ENEOS",80,12,6,"2026-07"],
  ["33-P01-M2F","PUMP C NO.2 SEAL OIL UNIT","Buffer Fluid Unit","TSL",null,null,null,32,"ENEOS",80,12,6,"2026-07"],
  ["33-P01D","CEMENT SURGE PUMP D","Centrifugal Pump","TSL",null,null,null,150,"MOBIL",2,12,6,"2026-07"],
  ["33-P01-M2E-LCS","PUMP C NO.1 SEAL OIL UNIT","Buffer Fluid Unit","TSL",null,null,null,10,"SHELL",100,12,6,null],
  ["33-P02A","COAGULATOR PUMP A","Centrifugal Pump","TSL",null,null,null,46,"PTT",1.8,6,3,"2026-07"],
  ["33-P02B","COAGULATOR PUMP B","Centrifugal Pump","TSL",null,null,null,46,"PTT",1.8,6,3,"2026-07"],
  ["33-P02C","COAGULATOR PUMP C","Centrifugal Pump","TSL",null,null,null,46,"PTT",1.8,6,3,"2026-07"],
  ["33-P03A","COAGULATOR DECANTER WATER PUMP A","Centrifugal Pump","TSL",null,null,null,32,"PTT",2,6,3,"2026-07"],
  ["33-P03B","COAGULATOR DECANTER WATER PUMP B","Centrifugal Pump","TSL",null,null,null,32,"PTT",2,6,3,"2026-07"],
  ["33-P04A","COAGULATOR DECANTER SOVENT PUMP A","Centrifugal Pump","TSL",null,null,null,32,"PTT",11.2,12,6,"2026-07"],
  ["33-P04B","COAGULATOR DECANTER SOVENT PUMP B","Centrifugal Pump","TSL",null,null,null,32,"PTT",11.2,12,6,"2026-07"],
  ["33-P05A","STRIPPER PUMP A","Centrifugal Pump","TSL",null,null,null,46,"PTT",3.4,6,3,"2026-07"],
  ["33-P05B","STRIPPER PUMP B","Centrifugal Pump","TSL",null,null,null,46,"PTT",3.4,6,3,"2026-07"],
  ["33-P06","SCREEN FEED PUMP","Centrifugal Pump","TSL",null,null,null,46,"PTT",1.8,6,3,"2026-07"],
  ["33-P07A","SLURRY SURGE PUMP A","Centrifugal Pump","TSL",null,null,null,46,"PTT",1.8,6,3,"2026-07"],
  ["33-P07B","SLURRY SURGE PUMP B","Centrifugal Pump","TSL",null,null,null,46,"PTT",1.8,6,3,"2026-07"],
  ["33-P07C","SLURRY SURGE PUMP C","Centrifugal Pump","TSL",null,null,null,46,"PTT",1.8,6,3,"2026-07"],
  ["33-P09A","HOT WATER RECOVERY PUMP A","Centrifugal Pump","TSL",null,null,null,46,"PTT",1.8,6,3,"2026-07"],
  ["33-P09B","HOT WATER RECOVERY PUMP B","Centrifugal Pump","TSL",null,null,null,46,"PTT",1.8,6,3,"2026-07"],
  ["33-P10A","CAUSTIC FEED PUMP A","Centrifugal Pump","TSL",null,null,null,32,"PTT",1,12,6,"2026-07"],
  ["33-P10B","CAUSTIC FEED PUMP B","Centrifugal Pump","TSL",null,null,null,32,"PTT",1,12,6,"2026-07"],
  ["33-P12","CAUSTIC TRANSFER PUMP","Centrifugal Pump","TSL",null,null,null,32,"PTT",0.5,12,6,"2026-07"],
  ["33-P14-A","Hot water Circultion pump A","Centrifugal Pump","TSL",null,null,null,46,"PTT",2.6,6,3,"2026-07"],
  ["33-P14-B","Hot water Circultion pump B","Centrifugal Pump","TSL",null,null,null,46,"PTT",2.6,6,3,"2026-07"],
  ["33-P56","CM FLASH WASHING COLUMN PH CONTROL PUMP","Other","TSL",null,null,null,32,"ENEOS",1.5,12,6,"2026-07"],
  ["33-P58-A","Fine Crumb Recovery Feed Pump A","Centrifugal Pump","TSL",null,null,null,46,"PTT",1.8,6,3,"2026-07"],
  ["33-P58-B","Fine Crumb Recovery Feed Pump A","Centrifugal Pump","TSL",null,null,null,46,"PTT",1.8,6,3,"2026-07"],
  ["33-P61-A","2nd Coagulator Decanter Feed Pump A","Centrifugal Pump","TSL",null,null,null,32,"PTT",0.31,6,3,"2026-07"],
  ["33-P61-B","2nd Coagulator Decanter Feed Pump B","Centrifugal Pump","TSL",null,null,null,32,"PTT",0.31,6,3,"2026-07"],
  ["33-P62-A (Per Pump VG 460)","2nd Coagulator Decanter Solvent Pump A (Per Pump VG 460)","Metering Pump","TSL",null,null,null,460,"MOBIL",10,6,3,"2026-07"],
  ["33-P62-A (Per Pump VG 32)","2nd Coagulator Decanter Solvent Pump A (Per Pump VG 32)","Metering Pump","TSL",null,null,null,32,"PTT",2.8,6,3,"2026-07"],
  ["33-P62-B (Per Pump VG 460)","2nd Coagulator Decanter Solvent Pump B (Per Pump VG 460)","Metering Pump","TSL",null,null,null,460,"MOBIL",10,6,3,"2026-07"],
  ["33-P62-B (Per Pump VG 32)","2nd Coagulator Decanter Solvent Pump B (Per Pump VG 32)","Metering Pump","TSL",null,null,null,32,"PTT",2.8,6,3,"2026-07"],
  ["33-S01-A","CEMENT FILTER A","Self-Cleaning Strainer","TSL",null,null,null,100,"MOBIL",12,12,6,"2026-07"],
  ["33-S01-B","CEMENT FILTER B","Self-Cleaning Strainer","TSL",null,null,null,100,"MOBIL",12,12,6,"2026-07"],
  ["33-S01-C","CEMENT FILTER C","Self-Cleaning Strainer","TSL",null,null,null,100,"MOBIL",12,12,6,"2026-07"],
  ["33-S01-E","CEMENT FILTER E","Self-Cleaning Strainer","TSL",null,null,null,100,"MOBIL",12,12,6,"2026-07"],
  ["331-A03 (Gear Reduce)","COAGULATOR AGITATOR (Gear Reduce)","Gearbox","TSL",null,null,null,220,"MOBIL",80,12,6,"2026-11"],
  ["331-A03 (M/C)","COAGULATOR AGITATOR (M/C)","Gearbox","TSL",null,null,null,32,"MOBIL",5,12,6,"2026-11"],
  ["331-P02-A","COAGULATOR PUMP A","Centrifugal Pump","TSL",null,null,null,46,"PTT",3.4,6,3,"2026-07"],
  ["331-P02-B","COAGULATOR PUMP B","Centrifugal Pump","TSL",null,null,null,46,"PTT",3.4,6,3,"2026-07"],
  ["34-A01","SLURRY DEWATERING TANK AGITATOR","Mechanical Agitator","TSL",null,null,null,150,"MOBIL",1.5,12,6,"2026-07"],
  ["34-A03-A","Chemical tank","Mechanical Agitator","TSL",null,null,null,220,"MOBIL",1.1,12,6,"2026-07"],
  ["34-A03-B","Chemical tank","Mechanical Agitator","TSL",null,null,null,220,"MOBIL",1.1,12,6,"2026-07"],
  ["34-P01A","SLURRY DEWATERING PUMP A","Centrifugal Pump","TSL",null,null,null,46,"PTT",1.9,6,3,"2026-07"],
  ["34-P01B","SLURRY DEWATERING PUMP B","Centrifugal Pump","TSL",null,null,null,46,"PTT",1.9,6,3,"2026-07"],
  ["34-P03-A","Crumb Slurry mixing pump A","Centrifugal Pump","TSL",null,null,null,46,"PTT",0.9,12,6,"2026-07"],
  ["34-P03-B","Crumb Slurry mixing pump B","Centrifugal Pump","TSL",null,null,null,46,"PTT",0.9,12,6,"2026-07"],
  ["34-P04A","SPRAY CIRCULATION PUMP A","Centrifugal Pump","TSL",null,null,null,32,"PTT",2,6,3,"2026-07"],
  ["34-P04B","SPRAY CIRCULATION PUMP B","Centrifugal Pump","TSL",null,null,null,32,"PTT",2,6,3,"2026-07"],
  ["34-Q01A","SPIRAL ELEVATOR A","Vibrating Conveyor","TSL",null,null,null,320,"MOBIL",6,12,6,"2026-11"],
  ["34-Q01B","SPIRAL ELEVATOR B","Vibrating Conveyor","TSL",null,null,null,320,"MOBIL",6,12,6,"2026-11"],
  ["34-U01A","SLURRY DEWATERING UNIT A (SDU)","Single Screw Extruder","TSL",null,null,null,220,"MOBIL",300,12,6,"2026-07"],
  ["34-U01B","SLURRY DEWATERING UNIT B (SDU)","Single Screw Extruder","TSL",null,null,null,220,"MOBIL",300,12,6,"2026-07"],
  ["34-U02A","VOLATILE CONTROL UNIT A (VCU)","Single Screw Extruder","TSL",null,null,null,220,"MOBIL",400,12,6,"2026-07"],
  ["34-U02B","VOLATILE CONTROL UNIT B (VCU)","Single Screw Extruder","TSL",null,null,null,220,"MOBIL",400,12,6,"2026-07"],
  ["34-Z02A","PELLETIZER","Pelletizer","TSL",null,null,null,220,"MOBIL",0.6,12,6,"2026-11"],
  ["34-Z02B","PELLETIZER","Pelletizer","TSL",null,null,null,220,"MOBIL",0.6,12,6,"2026-11"],
  ["34-Z04A","BALING PRESS A","Hydraulic Unit","TSL",null,null,null,32,"ENEOS",1400,24,12,"2026-07"],
  ["34-Z04B","BALING PRESS B","Hydraulic Unit","TSL",null,null,null,32,"ENEOS",1400,24,12,"2026-07"],
  ["34-Z08A","LIFTER A","Hydraulic Unit","TSL",null,null,null,46,"ENEOS",40,12,6,"2026-07"],
  ["34-Z08B","LIFTER B","Hydraulic Unit","TSL",null,null,null,46,"ENEOS",40,12,6,"2026-07"],
  ["34-Z12A","PRESS DOWN MACHINE A","Other","TSL",null,null,null,68,"ENEOS",400,12,6,"2026-07"],
  ["34-Z12B","PRESS DOWN MACHINE B","Other","TSL",null,null,null,68,"ENEOS",400,12,6,"2026-07"],
  ["35-P01A","SEAL WATER PUMP A","Centrifugal Pump","TSL",null,null,null,32,"PTT",1,12,6,"2026-07"],
  ["35-P01B","SEAL WATER PUMP B","Centrifugal Pump","TSL",null,null,null,32,"PTT",1,12,6,"2026-07"],
  ["35-P05A (Air Servo Unit)","BENZENE COLUMN BOTTOM PUMP A (Air Servo Unit)","Reciprocating Pump","TSL",null,null,null,10,"SHELL",2,12,6,"2026-07"],
  ["35-P05A (Crank Case)","BENZENE COLUMN BOTTOM PUMP A (Crank Case)","Reciprocating Pump","TSL",null,null,null,150,"MOBIL",2.5,12,6,"2026-07"],
  ["35-P05B (Air Servo Unit)","BENZENE COLUMN BOTTOM PUMP B (Air Servo Unit)","Reciprocating Pump","TSL",null,null,null,10,"SHELL",2,12,6,"2026-07"],
  ["35-P05B (Crank Case)","BENZENE COLUMN BOTTOM PUMP B (Crank Case)","Reciprocating Pump","TSL",null,null,null,150,"MOBIL",2.5,12,6,"2026-07"],
  ["35-P07A (Crank Case Gear)","RECOVERED M-1 PUMP A (Crank Case Gear)","Reciprocating Pump","TSL",null,null,null,460,"MOBIL",10,6,3,"2026-07"],
  ["35-P07A (Hydraulic oil)","RECOVERED M-1 PUMP A (Hydraulic oil)","Reciprocating Pump","TSL",null,null,null,32,"ENEOS",2.8,6,3,"2026-07"],
  ["35-P07B (Crank Case Gear)","RECOVERED M-1 PUMP B (Crank Case Gear)","Reciprocating Pump","TSL",null,null,null,460,"MOBIL",10,6,3,"2026-07"],
  ["35-P07B (Hydraulic oil)","RECOVERED M-1 PUMP B (Hydraulic oil)","Reciprocating Pump","TSL",null,null,null,32,"ENEOS",2.8,6,3,"2026-07"],
  ["35-P08A (Bearing)","M-1 COLUMN BOTTOM PUMP A (Bearing)","Centrifugal Pump","TSL",null,null,null,46,"PTT",1,12,6,"2026-07"],
  ["35-P08A (Mechanical Seal)","M-1 COLUMN BOTTOM PUMP A (Mechanical Seal)","Centrifugal Pump","TSL",null,null,null,32,"PTT",5,12,6,"2026-07"],
  ["35-P08B (Bearing)","M-1 COLUMN BOTTOM PUMP B (Bearing)","Centrifugal Pump","TSL",null,null,null,46,"PTT",1,12,6,"2026-07"],
  ["35-P08B (Mechanical Seal)","M-1 COLUMN BOTTOM PUMP B (Mechanical Seal)","Centrifugal Pump","TSL",null,null,null,32,"PTT",5,12,6,"2026-07"],
  ["35-P11A (Crank Gear oil)","BENZENE COLUMN BOTTOM PUMP A (Crank Gear oil)","Reciprocating Pump","TSL",null,null,null,220,"MOBIL",9,12,6,"2026-11"],
  ["35-P11A (Fuel oil)","BENZENE COLUMN BOTTOM PUMP A (Fuel oil)","Reciprocating Pump","TSL",null,null,null,0,"SHELL (SAE 15W-40)",9,12,6,"2026-11"],
  ["35-P11B (Crank Gear oil)","BENZENE COLUMN BOTTOM PUMP B (Crank Gear oil)","Reciprocating Pump","TSL",null,null,null,220,"MOBIL",9,12,6,"2026-11"],
  ["35-P11B (Fuel oil)","BENZENE COLUMN BOTTOM PUMP B (Fuel oil)","Reciprocating Pump","TSL",null,null,null,0,"SHELL (SAE 15W-40)",9,12,6,"2026-11"],
  ["35-P52A","BD WASHING COLUMN PH CONTROL PUMP A","Centrifugal Pump","TSL",null,null,null,32,"ENEOS",2,12,6,"2026-07"],
  ["35-P52B","BD WASHING COLUMN PH CONTROL PUMP B","Centrifugal Pump","TSL",null,null,null,32,"ENEOS",2,12,6,"2026-07"],
  ["35-P53A","RECOVERY SURGE FEED PUMP A","Centrifugal Pump","TSL",null,null,null,32,"PTT",10.5,12,6,"2026-07"],
  ["35-K01","VENT GAS COMPRESSOR","Compressor","TSL",null,null,null,46,"ENEOS",5,12,6,"2026-07"],
  ["7140-P01-A","Oil sealed rotary vacuum pump (lab.)","Other","TSL",null,null,null,68,"MOBIL",5,6,3,"2026-07"],
  ["7140-P01-B","Oil sealed rotary vacuum pump (lab.)","Other","TSL",null,null,null,68,"MOBIL",5,6,3,"2026-07"],
  ["1530-P06","HYDROGEN GAS COMP. DRAIN PUMP (AUTO RUN)","Reciprocating Pump","UFA",null,null,null,150,"MOBIL",1,12,6,null],
  ["1550-B01","COMBUSTION FAN","Blower/Fan","UFA",null,null,null,220,"MOBIL",1.2,12,6,"2026-11"],
  ["1550-F1","HEAT TRANSFER OIL FURNACE","Furnace","UFA",null,null,null,0,null,96400,96,48,"2026-07"],
  ["1550-P01-A","HEAT TRANSFER OIL CIRCULATION PUMP A","Centrifugal Pump","UFA",null,null,null,32,"ENEOS",3.9,12,6,"2026-11"],
  ["1550-P01-B","HEAT TRANSFER OIL CIRCULATION PUMP B","Centrifugal Pump","UFA",null,null,null,32,"ENEOS",3.9,12,6,"2026-11"],
  ["1550-P09","CONDENSATE RECIEVER PUMP","Centrifugal Pump","UFA",null,null,null,32,"ENEOS",0.5,12,6,"2026-11"],
  ["1560-P18","AQUEOUS EFFLUENT PUMP","Centrifugal Pump","UFA",null,null,null,32,"ENEOS",0.5,6,3,"2026-11"],
  ["1610-R1-A1","PCD REACTOR AGITATOR","Mechanical Agitator","UFA",null,null,null,150,"MOBIL",40,18,9,"2026-11"],
  ["1610-R2-A1","PCD REACTOR AGITATOR","Mechanical Agitator","UFA",null,null,null,150,"MOBIL",40,18,9,"2026-11"],
  ["1610-R3-A1","PCD REACTOR AGITATOR","Mechanical Agitator","UFA",null,null,null,150,"MOBIL",40,18,9,"2026-11"],
  ["1650-P2","CWI CIRCULATION PUMP","Centrifugal Pump","UFA",null,null,null,46,"ENEOS",0.6,6,3,"2026-11"],
  ["1650-P6","CWI Circulation Pump","Centrifugal Pump","UFA",null,null,null,68,"MOBIL",0.5,6,3,"2026-11"],
  ["1660-P9","Waste water pump","Centrifugal Pump","UFA",null,null,null,68,"MOBIL",2.63,6,3,"2026-11"],
  ["1660-P10","No.2 Aqueous Effluent pump","Centrifugal Pump","UFA",null,null,null,68,"MOBIL",1,6,3,"2026-11"],
  ["1660-V5-A1","CWI CIRCULATION PUMP","Centrifugal Pump","UFA",null,null,null,220,"MOBIL",2,12,6,"2026-11"],
  ["1570-Z08","Dock deverler PCD","Other","UFA",null,null,null,46,"ENEOS",5,12,6,"2026-11"],
  ["HYDRALIC OIL","HYDRALIC OIL","Other","UFA",null,null,null,46,"ENEOS",13,12,6,"2026-11"],
  ["11-P01","AH CIRCULATION PUMP","Centrifugal Pump","UNT",null,null,null,46,"PTT",0.5,6,3,"2026-07"],
  ["11-P06","No.2 AH Loading Pump","Magnetic Pump","UNT",null,null,null,68,"PTT",0.2,6,3,"2026-07"],
  ["12-A01","Screen Changer","Other","UNT",null,null,null,46,"ENEOS",60,12,6,"2026-07"],
  ["12-K01-A","VACCUM PUMP A","Pump","UNT",null,null,null,68,"PTT",5,6,3,"2026-07"],
  ["12-K01-B","VACCUM PUMP B","Pump","UNT",null,null,null,68,"PTT",5,6,3,"2026-07"],
  ["12-P02-A","CH FEED PUMP A","Metering Pump","UNT",null,null,null,150,"MOBIL",1,6,3,"2026-07"],
  ["12-P02-B","CH FEED PUMP B","Metering Pump","UNT",null,null,null,150,"MOBIL",1,6,3,"2026-07"],
  ["12-P03-A","PASTE FEED PUMP A","Reciprocating Pump","UNT",null,null,null,150,"MOBIL",4.5,12,6,"2026-07"],
  ["12-P03-B","PASTE FEED PUMP B","Reciprocating Pump","UNT",null,null,null,150,"MOBIL",4.5,12,6,"2026-07"],
  ["12-P05","NO.1 GEAR PUMP","Gear Pump","UNT",null,null,null,320,"MOBIL",2,12,6,"2026-11"],
  ["12-P06-A","NO.2 GEAR PUMP","Gear Pump","UNT",null,null,null,320,"MOBIL",64,24,12,"2026-11"],
  ["12-P07-A","MONOMER RECOVERY PUMP A","Centrifugal Pump","UNT",null,null,null,32,"PTT",0.3,6,3,null],
  ["12-P07-B","MONOMER RECOVERY PUMP A","Centrifugal Pump","UNT",null,null,null,32,"PTT",0.3,6,3,"2026-07"],
  ["12-P11","MELT PUMP","Gearbox","UNT",null,null,null,220,"MOBIL",19,12,6,"2026-11"],
  ["12-S05-M01","Motor at Water Tank","Motor Gearbox","UNT",null,null,null,220,"MOBIL",1.2,6,3,"2026-07"],
  ["12-S07","Diverter Valve","Other","UNT",null,null,null,46,"ENEOS",70,12,6,"2026-07"],
  ["12-V11-M01","Motor at Water Tank","Other","UNT",null,null,null,220,"MOBIL",1.2,6,3,"2026-07"],
  ["12-U3","OIL TEAPERING UNIT","Other","UNT",null,null,null,0,null,100,0,6,"2026-07"],
  ["12-Z01","HYDRAULIC PELLETIZER","Other","UNT",null,null,null,46,"ENEOS",5,6,3,"2026-07"],
  ["13-B01","NO.1 RC BLOWER","Lobe Blower","UNT",null,null,null,68,"PTT",4,6,3,"2026-07"],
  ["13-B02","NO.2 RC BLOWER","Lobe Blower","UNT",null,null,null,68,"PTT",4,6,3,"2026-07"],
  ["13-B03","WC BLOWER","Lobe Blower","UNT",null,null,null,68,"PTT",4,6,3,"2026-07"],
  ["13-P01","NO.1 SOLTD PUMP","Centrifugal Pump","UNT",null,null,null,46,"PTT",0.6,6,3,"2026-07"],
  ["13-P02","NO.2 SOLTD PUMP","Centrifugal Pump","UNT",null,null,null,46,"PTT",0.6,6,3,"2026-07"],
  ["13-S05","CENTRIFUGAL DEHYDRTOR","Centrifugal Separator","UNT",null,null,null,46,"PTT",13,12,6,"2026-07"],
  ["13-P09","NO.3 SOLTD PUMP","Centrifugal Pump","UNT",null,null,null,46,"PTT",0.6,6,3,"2026-07"],
  ["13-U06","RC ROTARY FEEDER","Motor Gearbox","UNT",null,null,null,220,"MOBIL",1.4,12,6,"2026-07"],
  ["14-D01 (Gear)","No.1 DRYER CYCLODRIVE (Gear)","Rotary Dryer","UNT",null,null,null,220,"MOBIL",21,6,3,"2026-07"],
  ["14-D01 (PM replacement oil chain)","No.1 DRYER CYCLODRIVE (PM replacement oil chain)","Rotary Dryer","UNT",null,null,null,32,"PTT",18,3,1,"2026-07"],
  ["14-D02 (Gear)","No.2 DRYER CYCLODRIVE (Gear)","Rotary Dryer","UNT",null,null,null,220,"MOBIL",21,6,3,"2026-07"],
  ["14-D02 (PM replacement oil chain)","No.2 DRYER CYCLODRIVE (PM replacement oil chain)","Rotary Dryer","UNT",null,null,null,32,"PTT",18,3,1,"2026-07"],
  ["14-D03 (Gear)","No.3 DRYER CYCLODRIVE (Gear)","Rotary Dryer","UNT",null,null,null,220,"MOBIL",21,6,3,"2026-07"],
  ["14-D03 (PM replacement oil chain)","No.3 DRYER CYCLODRIVE (PM replacement oil chain)","Rotary Dryer","UNT",null,null,null,32,"PTT",18,3,1,"2026-07"],
  ["14-D04 (Gear)","No.4 DRYER CYCLODRIVE (Gear)","Rotary Dryer","UNT",null,null,null,220,"MOBIL",21,6,3,"2026-07"],
  ["14-D04 (PM replacement oil chain)","No.4 DRYER CYCLODRIVE (PM replacement oil chain)","Rotary Dryer","UNT",null,null,null,32,"PTT",18,3,1,"2026-07"],
  ["14-D05 (Gear)","No.5 DRYER CYCLODRIVE (Gear)","Rotary Dryer","UNT",null,null,null,220,"MOBIL",21,6,3,"2026-07"],
  ["14-D05 (PM replacement oil chain)","No.5 DRYER CYCLODRIVE (PM replacement oil chain)","Rotary Dryer","UNT",null,null,null,32,"PTT",18,3,1,"2026-07"],
  ["14-D06 (Gear)","No.6 DRYER CYCLODRIVE (Gear)","Rotary Dryer","UNT",null,null,null,220,"MOBIL",21,6,3,"2026-07"],
  ["14-D06 (PM replacement oil chain)","No.6 DRYER CYCLODRIVE (PM replacement oil chain)","Rotary Dryer","UNT",null,null,null,32,"PTT",18,3,1,"2026-07"],
  ["15-B01","No.1 DC BLOWER (AUTO RUN)","Lobe Blower","UNT",null,null,null,68,"PTT",6.4,6,3,"2026-07"],
  ["15-B02","No.2 DC BLOWER (AUTO RUN)","Lobe Blower","UNT",null,null,null,68,"PTT",6.4,6,3,"2026-07"],
  ["15-B03","No.3 DC BLOWER (AUTO RUN)","Lobe Blower","UNT",null,null,null,68,"PTT",6.4,6,3,"2026-07"],
  ["15-U1","NO.1 DC FEEDER","Motor Gearbox","UNT",null,null,null,220,"MOBIL",1.3,12,6,"2026-07"],
  ["15-U02-K01","VACUUM PUMP","Pump","UNT",null,null,null,68,"MOBIL",1.5,6,3,"2026-11"],
  ["16-P02-A2","VACUUM PUMP","Pump","UNT",null,null,null,68,"PTT",3,6,3,"2026-07"],
  ["16-P02-B2","VACUUM PUMP","Pump","UNT",null,null,null,68,"PTT",3,6,3,"2026-07"],
  ["16-P04-A","C3 FEED PUMP","Centrifugal Pump","UNT",null,null,null,32,"PTT",0.3,12,6,"2026-07"],
  ["16-P04-B","C3 FEED PUMP","Centrifugal Pump","UNT",null,null,null,32,"PTT",0.3,12,6,"2026-07"],
  ["20-K01","HMG VACUUM PUMP","Other","UNT",null,null,null,68,"PTT",5,12,6,"2026-11"],
  ["21-P02-A","CW RECOVERY PUMP A","Centrifugal Pump","UNT",null,null,null,68,"PTT",1.9,6,3,"2026-07"],
  ["21-P02-B","CW RECOVERY PUMP B","Centrifugal Pump","UNT",null,null,null,68,"PTT",1.9,6,3,"2026-07"],
  ["21-P03-A","No.5 Cooling PUMP A","Centrifugal Pump","UNT",null,null,null,46,"PTT",0.9,6,3,"2026-07"],
  ["21-P03-B","No.6 Cooling PUMP B","Centrifugal Pump","UNT",null,null,null,46,"PTT",0.9,6,3,"2026-07"],
  ["21-U04-A","NO.4 COOLING TOWER A","Cooling Tower","UNT",null,null,null,460,"MOBIL",5,6,3,"2026-11"],
  ["21-U04-B","NO.4 COOLING TOWER B","Cooling Tower","UNT",null,null,null,460,"MOBIL",5,6,3,"2026-11"],
  ["22-P01-A","HW PUMP A","Centrifugal Pump","UNT",null,null,null,68,"PTT",0.7,6,3,"2026-07"],
  ["22-P01-B","HW PUMP B","Centrifugal Pump","UNT",null,null,null,68,"PTT",0.7,6,3,"2026-07"],
  ["26-P01-A","DESUPERHEATER PUMP A","Centrifugal Pump","UNT",null,null,null,46,"PTT",0.5,12,6,"2026-07"],
  ["26-P01-B","DESUPERHEATER PUMP A","Centrifugal Pump","UNT",null,null,null,46,"PTT",0.5,12,6,"2026-07"],
  ["32-P07-A","WW PUMP A","Centrifugal Pump","UNT",null,null,null,32,"PTT",0.3,6,3,"2026-07"],
  ["32-P07-B","WW PUMP B","Centrifugal Pump","UNT",null,null,null,32,"PTT",0.3,6,3,"2026-07"],
  ["32-P09-A","NO.2 WASTE WATER PUMP A","Centrifugal Pump","UNT",null,null,null,32,"PTT",0.3,6,3,"2026-07"],
  ["32-P09-B","NO.2 WASTE WATER PUMP B","Centrifugal Pump","UNT",null,null,null,32,"PTT",0.3,6,3,"2026-07"],
  ["32-P10-A","WASTE WATER PUMP A","Centrifugal Pump","UNT",null,null,null,32,"PTT",0.9,6,3,"2026-07"],
  ["32-P10-B","WASTE WATER PUMP B","Centrifugal Pump","UNT",null,null,null,32,"PTT",0.9,6,3,"2026-07"],
  ["41-A1","NO.1 ONE TON BLENDER","Mixer/Blender","UNT",null,null,null,460,"MOBIL",8,6,3,"2026-07"],
  ["41-B1","AIR -INJET BLOWER (AUTO RUN)","Blower/Fan","UNT",null,null,null,68,"PTT",1.7,6,3,"2026-07"],
  ["N141-J01-M01","ROTARY VALVE MOTOR","Motor Gearbox","UNT",null,null,null,220,"MOBIL",2,12,6,"2026-07"],
  ["N141-Z04-M01","NO.1 DISCHARGE CONVEYER MOTOR","Motor Gearbox","UNT",null,null,null,220,"MOBIL",2,12,6,"2026-07"],
  ["41-Z04-M03","NO.2 DISCHARGE CONVEYER","Motor Gearbox","UNT",null,null,null,220,"MOBIL",2,12,6,"2026-07"],
  ["N141-Z04-M07","OUTLET INVERSION CONVEYER","Motor Gearbox","UNT",null,null,null,220,"MOBIL",2,12,6,"2026-07"],
  ["N141-Z04-M08","CONVEYER WITH UP-DOWN DEVICE","Motor Gearbox","UNT",null,null,null,220,"MOBIL",2,12,6,"2026-07"],
  ["216-A1","MRP STORAGE TANK AGITATOR","Other","UNT",null,null,null,150,"MOBIL",7.5,6,3,"2026-07"],
  ["216-P01-A","1 ST EVAPORATOR FEED PUMP A","Centrifugal Pump","UNT",null,null,null,32,"PTT",1.8,12,6,"2026-07"],
  ["216-P01-B","1 ST EVAPORATOR FEED PUMP B","Centrifugal Pump","UNT",null,null,null,32,"PTT",1.8,12,6,"2026-07"],
  ["216-P02-A","1 ST EVAPORATOR CIRCULATION PUMP A","Centrifugal Pump","UNT",null,null,null,32,"PTT",1.8,12,6,"2026-07"],
  ["216-P02-B","1 ST EVAPORATOR CIRCULATION PUMP B","Centrifugal Pump","UNT",null,null,null,32,"PTT",1.8,12,6,"2026-07"],
  ["216-P03-A","2 ND EVAPORATOR CIRCULATION PUMP A","Centrifugal Pump","UNT",null,null,null,32,"PTT",1.8,12,6,"2026-07"],
  ["216-P03-B","2 ND EVAPORATOR CIRCULATION PUMP B","Centrifugal Pump","UNT",null,null,null,32,"PTT",1.8,12,6,"2026-07"],
  ["216-P04-A","3RD EVAPORATOR CIRCULTAION PUMP A","Centrifugal Pump","UNT",null,null,null,32,"PTT",2,12,6,"2026-07"],
  ["216-P04-B","3RD EVAPORATOR CIRCULTAION PUMP B","Centrifugal Pump","UNT",null,null,null,32,"PTT",2,12,6,"2026-07"],
  ["216-P05-A","MRP FEED PUMP A","Centrifugal Pump","UNT",null,null,null,32,"PTT",2,12,6,"2026-07"],
  ["216-P06-A","EVAPORATION RECYCLE PUMP A","Centrifugal Pump","UNT",null,null,null,32,"PTT",1.8,12,6,"2026-07"],
  ["216-P06-B","EVAPORATION RECYCLE PUMP B","Centrifugal Pump","UNT",null,null,null,32,"PTT",1.8,12,6,"2026-07"],
  ["216-P08-A","NO. 2 MRP FEED PUMP A","Centrifugal Pump","UNT",null,null,null,32,"PTT",0.8,6,3,"2026-07"],
  ["216-P08-B","NO. 2 MRP FEED PUMP B","Centrifugal Pump","UNT",null,null,null,32,"PTT",0.8,6,3,"2026-07"],
  ["221-P01-A","COOLING PUMP A","Centrifugal Pump","UNT",null,null,null,46,"PTT",2,6,3,"2026-07"],
  ["221-P01-B","COOLING PUMP B","Centrifugal Pump","UNT",null,null,null,46,"PTT",2,6,3,"2026-07"],
  ["221-P01-C","COOLING PUMP C","Centrifugal Pump","UNT",null,null,null,46,"PTT",2,6,3,"2026-07"],
  ["221-P01-D","COOLING PUMP D","Centrifugal Pump","UNT",null,null,null,46,"PTT",2,6,3,"2026-07"],
  ["221-U01-A","COOLING TOWER A","Axial Blower","UNT",null,null,null,220,"MOBIL",18,12,6,"2026-11"],
  ["221-U01-B","COOLING TOWER B","Axial Blower","UNT",null,null,null,220,"MOBIL",18,12,6,"2026-11"],
  ["223-P01","DW BOOSTER PUMP","Centrifugal Pump","UNT",null,null,null,46,"PTT",0.4,6,3,"2026-07"],
  ["228-P01","KB BOOSTER PUMP","Centrifugal Pump","UNT",null,null,null,46,"PTT",0.35,6,3,"2026-07"],
  ["241-A1","5 MT BLENDER POINT 1","Other","UNT",null,null,null,320,"MOBIL",25,24,12,"2026-07"],
  ["241-B01","ROOT BLOWER","Blower/Fan","UNT",null,null,null,100,"MOBIL",4,6,3,"2026-07"],
  ["241-U02-M01","CHIP FEEDER","Motor Gearbox","UNT",null,null,null,220,"MOBIL",1.8,6,3,"2026-07"],
  ["241-U1-Z9","VACUUM & HEATING SEAL BIG BAG MACHINE","Other","UNT",null,null,null,68,"MOBIL",1.5,6,3,"2026-11"],
  ["50-U06-M01","ROTARY VALVE MOTOR NO.1","Motor Gearbox","UNT",null,null,null,220,"MOBIL",2,12,6,"2026-07"],
  ["50-U06-M02","ROTARY VALVE MOTOR NO.2","Motor Gearbox","UNT",null,null,null,220,"MOBIL",2,12,6,"2026-07"],
  ["50-U06-M03","ROTARY VALVE MOTOR NO.3","Motor Gearbox","UNT",null,null,null,220,"MOBIL",2,12,6,"2026-07"],
  ["51-A01-1.1","NO. 1 BLENDER 500 KG","Tumbler Mixer","UNT",null,null,null,320,"MOBIL",3,12,6,"2026-07"],
  ["51-A01-1.2","NO. 1 BLENDER 500 KG","Tumbler Mixer","UNT",null,null,null,320,"MOBIL",2,12,6,"2026-07"],
  ["51-A01-2","NO. 1 BLENDER 500 KG","Tumbler Mixer","UNT",null,null,null,220,"MOBIL",5,12,6,"2026-07"],
  ["51-A02","BLENDING 50 KG.","Tumbler Mixer","UNT",null,null,null,220,"MOBIL",2,12,6,"2026-07"],
  ["51-A03","NC BENDER","Other","UNT",null,null,null,220,"MOBIL",5,6,3,"2026-07"],
  ["51-U01-B01","NC VACUUM BLOWER","Blower/Fan","UNT",null,null,null,68,"PTT",2.1,6,3,"2026-07"],
  ["51-B01","NC BLOWER","Lobe Blower","UNT",null,null,null,68,"PTT",2.5,12,6,"2026-07"],
  ["52-A07","NO.1 RIBBON BLENDER","Mixer/Blender","UNT",null,null,null,460,"MOBIL",2.2,12,6,"2026-07"],
  ["52-A08","NO.2 RIBBON BLENDER","Mixer/Blender","UNT",null,null,null,460,"MOBIL",2.2,12,6,"2026-07"],
  ["52-J02","GC FEEDER","Other","UNT",null,null,null,68,"ENEOS",1,12,6,"2026-07"],
  ["52-J03","NO.1 GC FEEDER","Belt Conveyor","UNT",null,null,null,68,"ENEOS",1,12,6,"2026-07"],
  ["52-J04","NO.2 GC FEEDER","Belt Conveyor","UNT",null,null,null,68,"ENEOS",1,12,6,"2026-07"],
  ["52-J07","NO.1 GC FEEDER","Belt Conveyor","UNT",null,null,null,68,"ENEOS",1,12,6,"2026-07"],
  ["52-M01","TWIN SCREW EXTRUDER","Twin Screw Extruder","UNT",null,null,null,220,"MOBIL",65,6,3,"2026-08"],
  ["52-M01-M02","SIDE COMPACTOR FEEDER MOTOR","Other","UNT",null,null,null,100,"MOBIL",1,6,3,"2026-07"],
  ["52-M02","TWIN SCREW EXTRUDER","Twin Screw Extruder","UNT",null,null,null,220,"MOBIL",65,6,3,"2026-08"],
  ["52-M02-M02","SIDE COMPACTOR FEEDER MOTOR","Other","UNT",null,null,null,220,"MOBIL",1,6,3,"2026-07"],
  ["52-P01-A","LW PUMP","Centrifugal Pump","UNT",null,null,null,32,"PTT",0.6,6,3,"2026-07"],
  ["52-P01-B","LW PUMP","Centrifugal Pump","UNT",null,null,null,32,"PTT",0.6,6,3,"2026-07"],
  ["53-J01","SCREW CONVEYOR","Other","UNT",null,null,null,220,"MOBIL",2,12,6,"2026-07"],
  ["53-K01","INST AIR COMPRESSOR","Integr. Gear Compressor","UNT",null,null,null,0,"KOBELCO",12,12,6,"2026-07"],
  ["53-Q01","NO.1 CONVEYOR","Other","UNT",null,null,null,220,"MOBIL",0.5,12,6,"2026-07"],
  ["53-Q02","NO.2 CONVEYOR","Other","UNT",null,null,null,220,"MOBIL",0.5,12,6,"2026-07"],
  ["60-U1-M1","DUST COLLECTOR","Bag Strainer","UNT",null,null,null,220,"MOBIL",0.4,12,6,"2026-07"],
  ["60-U1-M2","DUST COLLECTOR","Bag Strainer","UNT",null,null,null,220,"MOBIL",0.4,12,6,"2026-07"],
  ["61-A1","BLENDER","Tumbler Mixer","UNT",null,null,null,460,"MOBIL",7,12,6,"2026-07"],
  ["61-A2","ADDITIVE PREBLENDER","Tumbler Mixer","UNT",null,null,null,460,"MOBIL",0.6,12,6,"2026-07"],
  ["62-P1-A","LW PUMP A","Centrifugal Pump","UNT",null,null,null,32,"PTT",0.4,6,3,"2026-07"],
  ["62-P1-B","LW PUMP B","Centrifugal Pump","UNT",null,null,null,32,"PTT",0.4,6,3,"2026-07"],
  ["62-U1","EXTRUDER","Twin Screw Extruder","UNT",null,null,null,220,"MOBIL",80,12,6,"2026-07"],
  ["62-J2","GC FEEDER","Feeder","UNT",null,null,null,68,"ENEOS",1,12,6,"2026-07"],
  ["62-J3","THIN SCREW SIDE FEEDER","Motor Gearbox","UNT",null,null,null,220,"MOBIL",0.8,12,6,"2026-07"],
  ["63-U02-Q01","CONVERYOR","Other","UNT",null,null,null,220,"MOBIL",0.8,12,6,"2026-07"],
  ["63-U03-K01","VACUUM PUMP","Other","UNT",null,null,null,68,"MOBIL",1.5,6,3,"2026-11"],
  ["70-P1-A","CW Pump","Centrifugal Pump","UNT",null,null,null,32,"PTT",0.5,6,3,"2026-07"],
  ["70-P1-B","CW Pump","Centrifugal Pump","UNT",null,null,null,32,"PTT",0.5,6,3,"2026-07"],
  ["70-P2-A","WW PUMP","Centrifugal Pump","UNT",null,null,null,32,"PTT",0.2,6,3,"2026-07"],
  ["70-P2-B","WW PUMP","Centrifugal Pump","UNT",null,null,null,32,"PTT",0.2,6,3,"2026-07"],
  ["70-U01","COOLING TOWER","Cooling Tower","UNT",null,null,null,460,"MOBIL",5,6,3,"2026-11"],
  ["70-U02-B01","BLOWER","Blower/Fan","UNT",null,null,null,32,"PTT",0.8,3,1,"2026-07"],
  ["71-A1","ADDITIVE FREBLENDER","Tumbler Mixer","UNT",null,null,null,320,"MOBIL",8,6,3,"2026-07"],
  ["71-A2","ADDITIVE FREBLENDER","Tumbler Mixer","UNT",null,null,null,320,"MOBIL",0.5,6,3,"2026-07"],
  ["71-U1-B1","BLOWER","Blower/Fan","UNT",null,null,null,100,"MOBIL",1.8,3,1,"2026-07"],
  ["71-U1-B2","BLOWER","Blower/Fan","UNT",null,null,null,100,"MOBIL",1.8,3,1,"2026-07"],
  ["72-A02-J2","RIBBON BLENDER","Mixer/Blender","UNT",null,null,null,460,"MOBIL",0.5,6,3,"2026-07"],
  ["72-P1-A","LWS Pump","Centrifugal Pump","UNT",null,null,null,32,"PTT",0.2,6,3,"2026-07"],
  ["72-P1-B","LWS Pump","Centrifugal Pump","UNT",null,null,null,32,"PTT",0.2,6,3,"2026-07"],
  ["72-P2","LWR Pump","Centrifugal Pump","UNT",null,null,null,32,"PTT",0.2,6,3,"2026-07"],
  ["72-U01-M01","EXTRUDER","Twin Screw Extruder","UNT",null,null,null,220,"MOBIL",75,6,3,"2026-07"],
  ["72-U01-J01","SIDE FEEDER MOTOR","Motor Gearbox","UNT",null,null,null,220,"MOBIL",0.6,6,3,"2026-07"],
  ["72-U02","CHILLER","Other","UNT",null,null,null,0,null,0,0,6,"2026-11"],
  ["73-U1-Z9","VACUUM & HEATING SEAL BIG BAG MACHINE","Other","UNT",null,null,null,68,"MOBIL",1.5,6,3,"2026-11"],
  ["1 STR (gear VG 220)","Monofilament : NO/4NO. 01 STRETCHINGROLLSTAND. (gear VG 220)","Other","UTCA",null,null,null,220,"MOBIL",20,24,12,"2026-07"],
  ["1 STR (gear VG 320)","Monofilament : NO/4NO. 01 STRETCHINGROLLSTAND. (gear VG 320)","Other","UTCA",null,null,null,320,"MOBIL",0.9,24,12,"2026-07"],
  ["2 STR (gear VG 220)","Monofilament : NO/6NO. 2 STRETCHINGROLLSTAND. (gear VG 220)","Other","UTCA",null,null,null,220,"MOBIL",20,24,12,"2026-07"],
  ["2 STR (gear VG 320)","Monofilament : NO/6NO. 2 STRETCHINGROLLSTAND. (gear VG 320)","Other","UTCA",null,null,null,320,"MOBIL",0.9,24,12,"2026-07"],
  ["3 STR (gear VG 220)","Monofilament : NO/9NO. 3 STRETCHINGROLLSTAND. (gear VG 220)","Other","UTCA",null,null,null,220,"MOBIL",20,24,12,"2026-07"],
  ["3 STR (gear VG 320)","Monofilament : NO/9NO. 3 STRETCHINGROLLSTAND. (gear VG 320)","Other","UTCA",null,null,null,320,"MOBIL",0.9,24,12,"2026-07"],
  ["4 STR (gear VG 220)","Monofilament :NO/12 DILINGROLLUNIT (gear VG 220)","Other","UTCA",null,null,null,220,"MOBIL",20,24,12,"2026-07"],
  ["4 STR (gear VG 320)","Monofilament :NO/12 DILINGROLLUNIT (gear VG 320)","Other","UTCA",null,null,null,320,"MOBIL",0.9,24,12,"2026-07"],
  ["CS-35-26-N/HK 2","Monofilament :NO/01 EXTRUDER","Other","UTCA",null,null,null,320,"MOBIL",4.8,24,12,"2026-07"],
  ["Twin screw no. 1","Twin screw no. 1","Gearbox","UTCA",null,null,null,320,"MOBIL",26,24,12,"2026-07"],
  ["Twin screw no. 2","Twin screw no. 2","Feeder","UTCA",null,null,null,320,"MOBIL",0.8,24,12,"2026-11"],
  ["Twin screw no. 3","Twin screw no. 3","Feeder","UTCA",null,null,null,320,"MOBIL",1.2,24,12,"2026-11"],
  ["M/C no. 3300 22 16","Film EXTRUDER","Other","UTCA",null,null,null,220,"MOBIL",2.5,24,12,"2026-07"],
  ["M/C no. 325A 22 16","Film EXTRUDER","Other","UTCA",null,null,null,220,"MOBIL",2.5,24,12,"2026-07"],
  ["M/C no. 325B 22 16","Film EXTRUDER","Other","UTCA",null,null,null,220,"MOBIL",3,24,12,"2026-07"],
];

let cachedAssets: Asset[] | null = null;
let cachedAssetsVersion = "";

// Demo Mode's stand-in for compute_health(): health/status come from each
// asset's latest readings via the same getDeductionBreakdown() the Drill-down
// and Alarm Config pages use, so every page agrees (Iron Rule, AGENTS.md).
let demoAssetIds: Set<string> | null = null;
export function isDemoAssetId(id: string): boolean {
  demoAssetIds ??= new Set(RAW_ASSETS.map((r) => r[0]));
  return demoAssetIds.has(id);
}

export function getDemoAssets(): Asset[] {
  // Local Store writes change the latest readings → recompute health (still via the parity port).
  const version = isLocalStore() ? localStoreVersion() : "";
  if (cachedAssets && version === cachedAssetsVersion) return cachedAssets;
  cachedAssetsVersion = version;
  const baseParams = getDemoAlarmParams();
  const baseScoreConfig = getDemoScoreConfig();
  cachedAssets = RAW_ASSETS.map((r) => {
    const id = r[0];
    const vgGrade = r[7];

    const paramOverrides = getDemoAssetAlarmOverrides(id);
    const params = paramOverrides.length
      ? baseParams.map((p) => {
          const ov = paramOverrides.find((o) => o.category === p.category && o.key === p.key);
          if (!ov) return p;
          return {
            ...p,
            warn_limit: ov.warn_limit ?? p.warn_limit,
            crit_limit: ov.crit_limit ?? p.crit_limit,
            warn_penalty: ov.warn_penalty ?? p.warn_penalty,
            crit_penalty: ov.crit_penalty ?? p.crit_penalty,
          };
        })
      : baseParams;

    const scoreOverride = getDemoAssetScoreOverride(id);
    const scoreConfig = scoreOverride
      ? {
          oil_weight: scoreOverride.oil_weight ?? baseScoreConfig.oil_weight,
          vib_weight: scoreOverride.vib_weight ?? baseScoreConfig.vib_weight,
          warn_penalty: scoreOverride.warn_penalty ?? baseScoreConfig.warn_penalty,
          crit_penalty: scoreOverride.crit_penalty ?? baseScoreConfig.crit_penalty,
        }
      : baseScoreConfig;

    const oilHistory = getDemoOilHistory(id);
    const vibHistory = getDemoVibHistory(id);
    const latestOil = oilHistory.length ? oilHistory[oilHistory.length - 1] : null;
    const latestVib = vibHistory.length ? vibHistory[vibHistory.length - 1] : null;
    const { netScore } = getDeductionBreakdown(latestOil, latestVib, params, scoreConfig, vgGrade);

    return {
      id, name: r[1], type: r[2], site: r[3], health: netScore, status: statusFromHealth(netScore),
      install_date: r[4], motor_kw: r[5], rpm: r[6], vg_grade: r[7],
      oil_brand: r[8], oil_qty_l: r[9], oil_change_months: r[10],
      oil_sample_months: r[11],
      // a newer locally saved reading moves "last update" forward
      last_update: [r[12], latestOil?.period, latestVib?.period].filter((p): p is string => !!p).sort().pop() ?? r[12],
    };
  });
  return cachedAssets;
}

// ── Reference data from Excel ──
export function getDemoReference(): ReferenceData {
  const sites: Site[] = [
    {
      "code": "CPL",
      "name": "CPL Plant",
      "sort_order": 1
    },
    {
      "code": "TSL",
      "name": "TSL Plant",
      "sort_order": 2
    },
    {
      "code": "UFA",
      "name": "UFA Plant",
      "sort_order": 3
    },
    {
      "code": "UNT",
      "name": "UNT Plant",
      "sort_order": 4
    },
    {
      "code": "UTCA",
      "name": "UTCA Plant",
      "sort_order": 5
    }
  ];
  const types: AssetType[] = [
    {
      "name": "Axial Blower",
      "abbr": "AB",
      "color": "#a855f7"
    },
    {
      "name": "Axial Split Pump",
      "abbr": "AS",
      "color": "#22d3ee"
    },
    {
      "name": "Bag Strainer",
      "abbr": "BS",
      "color": "#94a3b8"
    },
    {
      "name": "Belt Conveyor",
      "abbr": "BC",
      "color": "#a5b4fc"
    },
    {
      "name": "Blower/Fan",
      "abbr": "BF",
      "color": "#d8b4fe"
    },
    {
      "name": "Buffer Fluid Unit",
      "abbr": "BF",
      "color": "#dc2626"
    },
    {
      "name": "Centrifugal Pump",
      "abbr": "CP",
      "color": "#0ea5e9"
    },
    {
      "name": "Centrifugal Separator",
      "abbr": "CS",
      "color": "#a3e635"
    },
    {
      "name": "Compressor",
      "abbr": "CM",
      "color": "#fb923c"
    },
    {
      "name": "Cooling Tower",
      "abbr": "CT",
      "color": "#0284c7"
    },
    {
      "name": "Decanter Separator",
      "abbr": "DS",
      "color": "#84cc16"
    },
    {
      "name": "Feeder",
      "abbr": "FD",
      "color": "#d946ef"
    },
    {
      "name": "Filter",
      "abbr": "FL",
      "color": "#9ca3af"
    },
    {
      "name": "Furnace",
      "abbr": "FN",
      "color": "#ea580c"
    },
    {
      "name": "Gear Pump",
      "abbr": "GP",
      "color": "#0891b2"
    },
    {
      "name": "Gearbox",
      "abbr": "GB",
      "color": "#64748b"
    },
    {
      "name": "Hydraulic Unit",
      "abbr": "HU",
      "color": "#ef4444"
    },
    {
      "name": "Integr. Gear Compressor",
      "abbr": "IC",
      "color": "#f97316"
    },
    {
      "name": "Lobe Blower",
      "abbr": "LB",
      "color": "#c084fc"
    },
    {
      "name": "M/C",
      "abbr": "MC",
      "color": "#78716c"
    },
    {
      "name": "Magnetic Pump",
      "abbr": "MG",
      "color": "#155e75"
    },
    {
      "name": "Mechanical Agitator",
      "abbr": "MA",
      "color": "#14b8a6"
    },
    {
      "name": "Metering Pump",
      "abbr": "MP",
      "color": "#06b6d4"
    },
    {
      "name": "Mixer/Blender",
      "abbr": "MX",
      "color": "#0d9488"
    },
    {
      "name": "Motor",
      "abbr": "MO",
      "color": "#8b5cf6"
    },
    {
      "name": "Motor Gearbox",
      "abbr": "MG",
      "color": "#7c3aed"
    },
    {
      "name": "Oil Unit",
      "abbr": "OU",
      "color": "#b91c1c"
    },
    {
      "name": "Other",
      "abbr": "OT",
      "color": "#94a3b8"
    },
    {
      "name": "Pelletizer",
      "abbr": "PZ",
      "color": "#facc15"
    },
    {
      "name": "Pump",
      "abbr": "PM",
      "color": "#7dd3fc"
    },
    {
      "name": "Radial Split Pump",
      "abbr": "RS",
      "color": "#67e8f9"
    },
    {
      "name": "Reciprocating Compressor",
      "abbr": "RC",
      "color": "#fbbf24"
    },
    {
      "name": "Reciprocating Pump",
      "abbr": "RP",
      "color": "#38bdf8"
    },
    {
      "name": "Roller Conveyor",
      "abbr": "RC",
      "color": "#818cf8"
    },
    {
      "name": "Rotary Dryer",
      "abbr": "RD",
      "color": "#eab308"
    },
    {
      "name": "Scrapper Agitator",
      "abbr": "SA",
      "color": "#2dd4bf"
    },
    {
      "name": "Screw Blower",
      "abbr": "SB",
      "color": "#9333ea"
    },
    {
      "name": "Screw Compressor",
      "abbr": "SC",
      "color": "#f59e0b"
    },
    {
      "name": "Self-Cleaning Strainer",
      "abbr": "SS",
      "color": "#475569"
    },
    {
      "name": "Single Screw Extruder",
      "abbr": "SE",
      "color": "#ec4899"
    },
    {
      "name": "Steam Turbine",
      "abbr": "ST",
      "color": "#22c55e"
    },
    {
      "name": "Tumbler Mixer",
      "abbr": "TM",
      "color": "#0f766e"
    },
    {
      "name": "Twin Screw Extruder",
      "abbr": "TE",
      "color": "#f472b6"
    },
    {
      "name": "Vane Pump",
      "abbr": "VP",
      "color": "#164e63"
    },
    {
      "name": "Vibrating Conveyor",
      "abbr": "VC",
      "color": "#6366f1"
    }
  ];
  const typeMap: ReferenceData["typeMap"] = {
    "Axial Blower": {
      "abbr": "AB",
      "color": "#a855f7"
    },
    "Axial Split Pump": {
      "abbr": "AS",
      "color": "#22d3ee"
    },
    "Bag Strainer": {
      "abbr": "BS",
      "color": "#94a3b8"
    },
    "Belt Conveyor": {
      "abbr": "BC",
      "color": "#a5b4fc"
    },
    "Blower/Fan": {
      "abbr": "BF",
      "color": "#d8b4fe"
    },
    "Buffer Fluid Unit": {
      "abbr": "BF",
      "color": "#dc2626"
    },
    "Centrifugal Pump": {
      "abbr": "CP",
      "color": "#0ea5e9"
    },
    "Centrifugal Separator": {
      "abbr": "CS",
      "color": "#a3e635"
    },
    "Compressor": {
      "abbr": "CM",
      "color": "#fb923c"
    },
    "Cooling Tower": {
      "abbr": "CT",
      "color": "#0284c7"
    },
    "Decanter Separator": {
      "abbr": "DS",
      "color": "#84cc16"
    },
    "Feeder": {
      "abbr": "FD",
      "color": "#d946ef"
    },
    "Filter": {
      "abbr": "FL",
      "color": "#9ca3af"
    },
    "Furnace": {
      "abbr": "FN",
      "color": "#ea580c"
    },
    "Gear Pump": {
      "abbr": "GP",
      "color": "#0891b2"
    },
    "Gearbox": {
      "abbr": "GB",
      "color": "#64748b"
    },
    "Hydraulic Unit": {
      "abbr": "HU",
      "color": "#ef4444"
    },
    "Integr. Gear Compressor": {
      "abbr": "IC",
      "color": "#f97316"
    },
    "Lobe Blower": {
      "abbr": "LB",
      "color": "#c084fc"
    },
    "M/C": {
      "abbr": "MC",
      "color": "#78716c"
    },
    "Magnetic Pump": {
      "abbr": "MG",
      "color": "#155e75"
    },
    "Mechanical Agitator": {
      "abbr": "MA",
      "color": "#14b8a6"
    },
    "Metering Pump": {
      "abbr": "MP",
      "color": "#06b6d4"
    },
    "Mixer/Blender": {
      "abbr": "MX",
      "color": "#0d9488"
    },
    "Motor": {
      "abbr": "MO",
      "color": "#8b5cf6"
    },
    "Motor Gearbox": {
      "abbr": "MG",
      "color": "#7c3aed"
    },
    "Oil Unit": {
      "abbr": "OU",
      "color": "#b91c1c"
    },
    "Other": {
      "abbr": "OT",
      "color": "#94a3b8"
    },
    "Pelletizer": {
      "abbr": "PZ",
      "color": "#facc15"
    },
    "Pump": {
      "abbr": "PM",
      "color": "#7dd3fc"
    },
    "Radial Split Pump": {
      "abbr": "RS",
      "color": "#67e8f9"
    },
    "Reciprocating Compressor": {
      "abbr": "RC",
      "color": "#fbbf24"
    },
    "Reciprocating Pump": {
      "abbr": "RP",
      "color": "#38bdf8"
    },
    "Roller Conveyor": {
      "abbr": "RC",
      "color": "#818cf8"
    },
    "Rotary Dryer": {
      "abbr": "RD",
      "color": "#eab308"
    },
    "Scrapper Agitator": {
      "abbr": "SA",
      "color": "#2dd4bf"
    },
    "Screw Blower": {
      "abbr": "SB",
      "color": "#9333ea"
    },
    "Screw Compressor": {
      "abbr": "SC",
      "color": "#f59e0b"
    },
    "Self-Cleaning Strainer": {
      "abbr": "SS",
      "color": "#475569"
    },
    "Single Screw Extruder": {
      "abbr": "SE",
      "color": "#ec4899"
    },
    "Steam Turbine": {
      "abbr": "ST",
      "color": "#22c55e"
    },
    "Tumbler Mixer": {
      "abbr": "TM",
      "color": "#0f766e"
    },
    "Twin Screw Extruder": {
      "abbr": "TE",
      "color": "#f472b6"
    },
    "Vane Pump": {
      "abbr": "VP",
      "color": "#164e63"
    },
    "Vibrating Conveyor": {
      "abbr": "VC",
      "color": "#6366f1"
    }
  };
  return { sites, types, typeMap };
}

// ── Notifications derived from real assets ──
export function getDemoNotifications(): {
  asset: Asset;
  level: "crit" | "warn";
}[] {
  const a = getDemoAssets();
  const crit = a
    .filter((x) => x.status === "Critical")
    .sort((x, y) => x.health - y.health)
    .slice(0, 8)
    .map((asset) => ({ asset, level: "crit" as const }));
  const warn = a
    .filter((x) => x.status === "Warning")
    .sort((x, y) => x.health - y.health)
    .slice(0, 4)
    .map((asset) => ({ asset, level: "warn" as const }));
  return [...crit, ...warn];
}

// ── Config: alarm parameters (ISO-based thresholds) ──
// Must equal the SQL alarm_params (0002 seed + 0008 penalties + 0030 visc, minus
// Cu/Si dropped in 0031) —
// lib/demo-data.test.ts checks it, or scores change when Local Store data moves to Supabase.
export function getDemoAlarmParams(): AlarmParam[] {
  return [
    { id: "ap-fe", category: "oil", key: "fe", name: "Iron (Fe)", unit: "ppm", description: "ปริมาณเหล็กจากการสึกหรอของเกียร์/แบริ่ง", warn_limit: 100, crit_limit: 200, warn_penalty: 20, crit_penalty: 40 },
    { id: "ap-water", category: "oil", key: "water", name: "Water Content", unit: "ppm", description: "ความชื้นในน้ำมัน (ASTM D6304)", warn_limit: 500, crit_limit: 1000, warn_penalty: 15, crit_penalty: 35 },
    { id: "ap-tan", category: "oil", key: "tan", name: "TAN (mgKOH/g)", unit: "mgKOH/g", description: "ค่าความเป็นกรดของน้ำมัน", warn_limit: 0.5, crit_limit: 1.0, warn_penalty: 10, crit_penalty: 25 },
    { id: "ap-visc", category: "oil", key: "visc", name: "Viscosity @40°C", unit: "cSt", description: "ความหนืดของน้ำมัน (ISO 3448:1992 ±5% Warning, ±10% Critical) — คำนวณจาก VG Grade ของอุปกรณ์", warn_limit: 242, crit_limit: 264, warn_penalty: 10, crit_penalty: 25 },
    { id: "ap-vel", category: "vib", key: "vel", name: "Velocity RMS", unit: "mm/s", description: "ความเร็วแรงสั่นสะเทือน (ISO 20816-3)", warn_limit: 4.5, crit_limit: 7.1, warn_penalty: 20, crit_penalty: 40 },
    { id: "ap-acc", category: "vib", key: "acc", name: "Peak Acceleration", unit: "g-PK", description: "ค่าความเร่งแรงสั่น (Impact/Bearing)", warn_limit: 5, crit_limit: 10, warn_penalty: 15, crit_penalty: 30 },
  ];
}

export function getDemoScoreConfig(): ScoreConfig {
  return { oil_weight: 100, vib_weight: 0, warn_penalty: 15, crit_penalty: 30 };
}

// ── Per-asset alarm/score overrides (demo examples — most assets have none) ──
const DEMO_ASSET_ALARM_OVERRIDES: Record<string, AssetAlarmOverride[]> = {
  "1130-P09-A": [
    { id: "ov-1130-p09-a-vel", asset_id: "1130-P09-A", category: "vib", key: "vel", warn_limit: 3.5, crit_limit: 5.6, warn_penalty: 25, crit_penalty: 45 },
  ],
};

const DEMO_ASSET_SCORE_OVERRIDES: Record<string, AssetScoreOverride> = {
  "1130-P09-A": { asset_id: "1130-P09-A", oil_weight: 40, vib_weight: 60, warn_penalty: null, crit_penalty: null },
};

export function getDemoAssetAlarmOverrides(assetId: string): AssetAlarmOverride[] {
  return DEMO_ASSET_ALARM_OVERRIDES[assetId] ?? [];
}

export function getDemoAssetScoreOverride(assetId: string): AssetScoreOverride | null {
  return DEMO_ASSET_SCORE_OVERRIDES[assetId] ?? null;
}

// ── Dynamic RBAC (mirrors supabase/0023_dynamic_rbac.sql's seed data exactly,
// so demo mode shows the same roles/permissions/mapping a fresh real DB would) ──
const DEMO_PERMISSIONS: Permission[] = [
  { key: "system:bypass_site_access", label: "ข้ามข้อจำกัดการเข้าถึงตาม Site", category: "ระบบ" },
  { key: "users:manage", label: "จัดการผู้ใช้ / Role / สิทธิ์", category: "ระบบ" },
  { key: "sites:manage", label: "จัดการโรงงาน / ประเภทเครื่องจักร", category: "ระบบ" },
  { key: "notifications:manage", label: "ตั้งค่าการแจ้งเตือนอีเมล", category: "ระบบ" },
  { key: "audit:read", label: "ดู Audit Trail", category: "ระบบ" },
  { key: "assets:read", label: "มองเห็นเมนู ฐานข้อมูลเครื่องจักร", category: "เครื่องจักร" },
  { key: "assets:write", label: "สร้าง / แก้ไขเครื่องจักร", category: "เครื่องจักร" },
  { key: "assets:delete", label: "ลบเครื่องจักร", category: "เครื่องจักร" },
  { key: "assets:delete_all", label: "ลบเครื่องจักรทั้งหมด", category: "เครื่องจักร" },
  { key: "assets:import", label: "นำเข้าเครื่องจักรแบบชุด", category: "เครื่องจักร" },
  { key: "alarms:read", label: "มองเห็นเมนู ตั้งค่าแจ้งเตือน", category: "เครื่องจักร" },
  { key: "alarms:write", label: "ตั้งค่าเกณฑ์แจ้งเตือน / คะแนน", category: "เครื่องจักร" },
  { key: "readings:write", label: "บันทึกผลตรวจน้ำมัน / สั่นสะเทือน", category: "เครื่องจักร" },
  { key: "maintenance:write", label: "บันทึกประวัติซ่อมบำรุง", category: "เครื่องจักร" },
  { key: "dataentry:read", label: "มองเห็นเมนู ป้อนข้อมูล", category: "ป้อนข้อมูล" },
  { key: "attachments:write", label: "แนบ / ลบไฟล์แนบ", category: "ไฟล์แนบ" },
  { key: "attachments:read", label: "ดาวน์โหลดไฟล์แนบ", category: "ไฟล์แนบ" },
  { key: "standards:read", label: "มองเห็นเมนู คลังมาตรฐาน", category: "มาตรฐาน" },
  { key: "standards:write", label: "สร้าง / แก้ไข / ลบมาตรฐาน", category: "มาตรฐาน" },
  { key: "reports:view", label: "มองเห็นเมนู รายงานผู้บริหาร", category: "รายงาน" },
  { key: "reports:send_email", label: "ส่งรายงานทางอีเมล", category: "รายงาน" },
  { key: "reports:read_all", label: "ดูรายงานของทุกคน", category: "รายงาน" },
];

const DEMO_ROLES: Role[] = [
  // menu_main = the same starting layout 0034 seeds
  { id: "admin", label: "ผู้ดูแลระบบ (Admin)", is_system: true, menu_main: ["/dashboard", "/assets", "/config/alarms", "/admin"] },
  { id: "engineer", label: "วิศวกร (Engineer)", is_system: true, menu_main: ["/data-entry", "/dashboard", "/assets", "/config/alarms"] },
  { id: "manager", label: "ผู้จัดการ (Manager)", is_system: true, menu_main: ["/reports", "/dashboard"] },
  { id: "viewer", label: "ผู้ดูข้อมูล (Viewer)", is_system: true, menu_main: ["/dashboard", "/standards"] },
];

// Every "view" permission (module:read / reports:view) is granted to all 4
// built-in roles below — before this feature existed every menu was visible
// to any logged-in role regardless of role, so seeding it this way preserves
// that behavior exactly. The restriction capability is only exercised when an
// admin creates/edits a role and deliberately unchecks one of these.
const VIEW_PERMS = [
  "assets:read", "dataentry:read", "standards:read", "alarms:read", "reports:view",
];

const DEMO_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: DEMO_PERMISSIONS.map((p) => p.key),
  engineer: [
    ...VIEW_PERMS,
    "assets:write", "assets:delete", "assets:import",
    "alarms:write", "readings:write", "maintenance:write",
    "attachments:write", "attachments:read",
    "standards:write",
    "reports:send_email", "sites:manage", "notifications:manage",
    "audit:read",
  ],
  manager: [...VIEW_PERMS, "attachments:read", "maintenance:write", "audit:read"],
  viewer: [...VIEW_PERMS, "attachments:read"],
};

export function getDemoPermissions(): Permission[] {
  return DEMO_PERMISSIONS;
}

export function getDemoRoles(): Role[] {
  return DEMO_ROLES;
}

export function getDemoRolePermissions(roleId: string): string[] {
  return DEMO_ROLE_PERMISSIONS[roleId] ?? [];
}

// ── Standards reference (real ISO standards) ──
export function getDemoStandards(): Standard[] {
  return [
    { id: "std-1", category: "TRIBOLOGY", title: "ISO 4406:2021", subtitle: "Method for Coding the Level of Contamination by Solid Particles", description: "มาตรฐานสากลหลักสำหรับการรายงานระดับความสะอาดของน้ำมันหล่อลื่น", full_text: "รหัส 3 ตัว: R4/R6/R14 = รหัสของจำนวนอนุภาคต่อ 1 mL ที่ขนาด ≥4, ≥6 และ ≥14 µm(c) เช่น 18/16/13\nตารางรหัส: ใช้แปลงจำนวนอนุภาคเป็นรหัส (บางส่วนของตาราง)\n| รหัส | อนุภาคต่อ mL มากกว่า | ไม่เกิน |\n| 12 | 20 | 40 |\n| 13 | 40 | 80 |\n| 14 | 80 | 160 |\n| 15 | 160 | 320 |\n| 16 | 320 | 640 |\n| 17 | 640 | 1,300 |\n| 18 | 1,300 | 2,500 |\n| 19 | 2,500 | 5,000 |\n| 20 | 5,000 | 10,000 |\n| 21 | 10,000 | 20,000 |\n| 22 | 20,000 | 40,000 |\nอ่านค่า: รหัสเพิ่ม 1 = อนุภาคเพิ่มราว 2 เท่า · ตัวเลขยิ่งต่ำยิ่งสะอาด\nวิธีนับ: เครื่องนับอนุภาคอัตโนมัติ (สอบเทียบตาม ISO 11171) · นับด้วยกล้องจุลทรรศน์ (ISO 4407) รายงานเป็น -/R5/R15\nการนำไปใช้: ตั้งเป้าความสะอาดตามความไวของชิ้นส่วน (ระบบไฮดรอลิกและแบริ่งต้องสะอาดกว่าเกียร์) แล้วเทียบผลแลบกับเป้า\n## ใช้ในงาน UGT\nใช้ตอน: อ่านผลความสะอาดที่แลบรายงานเป็นรหัส เช่น 18/16/13\nในระบบ: ช่อง ISO Code ที่หน้าป้อนข้อมูล → แสดงในหน้ารายละเอียดเครื่อง แท็บน้ำมัน (ยังไม่ใช้คิด Health Score)\n## ข้อมูลเอกสาร\nแทนที่ฉบับ: ISO 4406:2017\nสถานะ: ใช้อยู่", tags: ["Particle Count", "ISO Cleanliness Code"], version: 2, updated_at: "2026-02-10T08:00:00Z", updated_by: "system", related_params: [], asset_types: ["Steam Turbine", "Gearbox", "Motor Gearbox", "Screw Compressor"], related_standard_ids: [] },
    { id: "std-2", category: "TRIBOLOGY", title: "ASTM D4378-20", subtitle: "In-Service Monitoring of Mineral Turbine Oils", description: "แนวทางติดตามสภาพน้ำมันเทอร์ไบน์", full_text: "ขอบเขต: ติดตามสภาพน้ำมันแร่ (mineral) ที่ใช้ในกังหันไอน้ำและกังหันก๊าซระหว่างใช้งาน\nการทดสอบหลัก: ลักษณะภายนอก · ความหนืด (ASTM D445) · TAN (ASTM D664/D974) · น้ำ (ASTM D6304) · ความต้านทานออกซิเดชัน RPVOT (ASTM D2272) · ความสะอาด (ISO 4406)\nการทดสอบเสริม: การแยกตัวจากน้ำ (ASTM D1401) · การเกิดฟอง (ASTM D892) · การปล่อยอากาศ (ASTM D3427) · กันสนิม (ASTM D665)\nการเก็บตัวอย่าง: เก็บจากจุดเดิมขณะเครื่องเดิน ตามรอบที่กำหนด และเก็บตัวอย่างน้ำมันใหม่ไว้เป็นค่าอ้างอิง\nการแปลผล: ดูแนวโน้มเทียบกับน้ำมันใหม่ (baseline) และผลครั้งก่อน มากกว่าดูค่าครั้งเดียว\n## ใช้ในงาน UGT\nใช้ตอน: วางโปรแกรมเก็บตัวอย่างน้ำมันเทอร์ไบน์ และเลือกรายการทดสอบที่สั่งแลบ\nในระบบ: เครื่องประเภท Steam Turbine · ผลความหนืด น้ำ และ TAN ป้อนที่หน้าป้อนข้อมูล ดูแนวโน้มที่หน้ารายละเอียดเครื่อง\n## ข้อมูลเอกสาร\nสถานะ: ASTM ทบทวนฉบับทุกไม่เกิน 5 ปี — ตรวจปีฉบับล่าสุดก่อนอ้างอิง", tags: ["Turbine Oil", "Trend Analysis"], version: 1, updated_at: "2026-01-15T08:00:00Z", updated_by: "system", related_params: ["water", "tan", "visc"], asset_types: ["Steam Turbine"], related_standard_ids: ["std-9", "std-10"] },
    { id: "std-3", category: "VIBRATION", title: "ISO 20816-3:2022", subtitle: "Mechanical vibration — Part 3: Industrial machinery with a power rating above 15 kW and speeds between 120 and 30 000 r/min", description: "เกณฑ์ประเมินการสั่นสะเทือนเครื่องจักร >15 kW (ฉบับแทน ISO 10816-3:2009)", full_text: "ขอบเขต: เครื่องจักรอุตสาหกรรม >15 kW ความเร็ว 120–30,000 rpm วัดที่ตัวเรือนแบริ่ง (non-rotating parts)\nกลุ่มเครื่อง: Group 1 = เครื่องใหญ่ >300 kW · Group 2 = เครื่องกลาง 15–300 kW\nค่าที่วัด: Velocity RMS (mm/s) ในแนวรัศมี 2 ทิศทางตั้งฉากกัน (แนวแกนเป็นทางเลือก)\nเกณฑ์โซน (Velocity RMS, mm/s): เทียบค่าสูงสุดที่วัดได้กับแถวของกลุ่มและชนิดฐานของเครื่อง\n| กลุ่ม / ฐาน | โซน A ใหม่ | โซน B เดินระยะยาวได้ | โซน C เดินได้ชั่วคราว | โซน D เสียหายได้ |\n| Group 2 · ฐานแข็ง | ≤ 1.4 | 1.4–2.8 | 2.8–4.5 | > 4.5 |\n| Group 2 · ฐานยืดหยุ่น | ≤ 2.3 | 2.3–4.5 | 4.5–7.1 | > 7.1 |\n| Group 1 · ฐานแข็ง | ≤ 2.3 | 2.3–4.5 | 4.5–7.1 | > 7.1 |\n| Group 1 · ฐานยืดหยุ่น | ≤ 3.5 | 3.5–7.1 | 7.1–11.0 | > 11.0 |\nความหมายโซน: A = เครื่องใหม่หรือหลังซ่อม · B = เดินต่อระยะยาวได้ · C = ไม่ควรเดินต่อเนื่องระยะยาว ควรวางแผนแก้ไข · D = รุนแรงพอทำให้เสียหาย\nแนวทางตั้งเตือน: ALARM ≈ ค่าฐาน + 25% ของขอบบนโซน B · TRIP โดยทั่วไปไม่เกิน 1.25 × ขอบ C/D\n## ใช้ในงาน UGT\nใช้ตอน: ประเมินผลวัดสั่นของเครื่อง >15 kW\nในระบบ: ค่า Velocity ป้อนที่หน้าป้อนข้อมูล ระบบเทียบกับเกณฑ์ในหน้าตั้งค่าแจ้งเตือน (ค่าที่โรงงานตั้ง)\nข้อควรระวัง: ระบุกลุ่มเครื่องและชนิดฐานให้ถูกก่อนเทียบโซน — ค่าเดียวกันอาจเป็นโซน B ของเครื่องหนึ่ง แต่เป็นโซน C ของอีกเครื่อง\n## ข้อมูลเอกสาร\nแทนที่ฉบับ: ISO 10816-3:2009 · ISO 7919-3:2009\nสถานะ: ใช้อยู่", tags: ["Velocity RMS Zone A–D", "Power >15 kW"], version: 3, updated_at: "2026-03-01T08:00:00Z", updated_by: "system", related_params: ["vel", "acc", "cf"], asset_types: ["Motor", "Reciprocating Pump", "Screw Compressor", "Belt Conveyor"], related_standard_ids: [] },
    { id: "std-4", category: "TRIBOLOGY", title: "AGMA 9005-F16", subtitle: "Industrial Gear Lubrication — Selection and Application", description: "การเลือกสารหล่อลื่นเกียร์อุตสาหกรรม", full_text: "ขอบเขต: เลือกและใช้น้ำมัน/จาระบีกับเกียร์อุตสาหกรรมแบบปิด (enclosed) และแบบเปิด (open)\nชนิดน้ำมัน: R&O (กันสนิมและออกซิเดชัน) · Antiscuff/EP (รับโหลดสูง) · Compounded (ผสมไขมัน นิยมกับเฟืองตัวหนอน) · Synthetic (PAO/PAG)\nการเลือกความหนืด: ดูความเร็วที่ pitch line ของเฟืองชุดช้าที่สุด และอุณหภูมิแวดล้อม/อุณหภูมิใช้งาน — ความเร็วต่ำและร้อนต้องหนืดสูงขึ้น\nข้อควรระวัง: ห้ามผสมน้ำมันต่างชนิด (เช่น PAG กับ mineral) · เปลี่ยนน้ำมันใหม่หลังเดินเครื่องครั้งแรก (break-in)\nการนำไปใช้: ตรวจว่าเกรด VG ที่ใช้ในทะเบียนเหมาะกับเกียร์ — มาตรฐานนี้ไม่ได้กำหนดเกณฑ์เตือนของผลวิเคราะห์น้ำมัน\n## ใช้ในงาน UGT\nใช้ตอน: ตรวจเกรด VG ในทะเบียน · เปลี่ยนยี่ห้อหรือเกรดน้ำมันเกียร์\nในระบบ: ช่อง VG Grade ที่หน้าฐานข้อมูลเครื่องจักร — เกรดนี้เป็นฐานของเกณฑ์ความหนืด ถ้าเกรดผิด ผลความหนืดจะเตือนผิด\n## ข้อมูลเอกสาร\nแทนที่ฉบับ: AGMA 9005-E02\nสถานะ: ใช้อยู่", tags: ["ISO VG 150–680", "EP Additive"], version: 1, updated_at: "2026-01-20T08:00:00Z", updated_by: "system", related_params: ["visc"], asset_types: ["Gearbox", "Motor Gearbox"], related_standard_ids: [] },
    { id: "std-5", category: "RELIABILITY", title: "ISO 17359:2018", subtitle: "Condition Monitoring and Diagnostics — General Guidelines", description: "กรอบหลักสำหรับโปรแกรม CBM", full_text: "ขอบเขต: กรอบการจัดทำโปรแกรมบำรุงรักษาตามสภาพ (Condition Monitoring) ใช้ได้กับเครื่องจักรทุกประเภท\nขั้นตอนหลัก: วิเคราะห์ความคุ้มค่า → สำรวจเครื่องจักรและหน้าที่ → จัดลำดับความสำคัญ (criticality) → วิเคราะห์ failure mode และอาการ → เลือกวิธีตรวจวัด → เก็บและวิเคราะห์ข้อมูล → ตัดสินใจงานบำรุงรักษา → ทบทวนโปรแกรม\nเลือกวิธีตรวจวัด: เลือกเทคนิคที่จับอาการของ failure mode ได้เร็วพอ เช่น วิเคราะห์น้ำมันจับการสึกหรอและการปนเปื้อน · วัดสั่นจับแบริ่งและ unbalance\nเกณฑ์เตือน: ตั้ง Alert/Alarm จากค่าฐาน (baseline) ประสบการณ์ หรือมาตรฐานเฉพาะเครื่อง และทบทวนเมื่อมีข้อมูลมากขึ้น\nรอบการวัด: สั้นกว่าช่วงเวลาตั้งแต่เริ่มเห็นอาการจนเสีย (P-F interval)\n## ใช้ในงาน UGT\nใช้ตอน: ทบทวนโปรแกรมตรวจสภาพประจำปี\nในระบบ: ทะเบียนเครื่อง → รอบเก็บตัวอย่าง → เกณฑ์แจ้งเตือน → ผลวิเคราะห์ → รายงาน คือขั้นตอนของมาตรฐานนี้\n## ข้อมูลเอกสาร\nแทนที่ฉบับ: ISO 17359:2011\nสถานะ: ใช้อยู่", tags: ["Failure Mode Analysis", "CBM Program"], version: 1, updated_at: "2026-01-10T08:00:00Z", updated_by: "system", related_params: ["fe", "tan", "visc", "vel", "acc"], asset_types: ["Motor", "Reciprocating Pump", "Gearbox", "Motor Gearbox"], related_standard_ids: [] },
    { id: "std-6", category: "TRIBOLOGY", title: "ISO 11158:2009", subtitle: "Lubricants, industrial oils — Specifications for family H (hydraulic fluids)", description: "ข้อกำหนดคุณภาพน้ำมันไฮดรอลิกครอบครัว H (HH/HL/HM/HV/HG) ใช้กับระบบไฮดรอลิกโรงงาน — ครอบคลุมความหนืด ISO VG, Anti-Wear, Demulsibility และ Filterability", full_text: "ขอบเขต: ข้อกำหนดน้ำมันไฮดรอลิกกลุ่ม H สำหรับระบบไฮดรอลิกทั่วไป\nประเภท: เลือกให้ตรงกับงาน\n| ประเภท | คุณสมบัติ |\n| HH | น้ำมันแร่ ไม่เติมสาร |\n| HL | เติมสารกันสนิมและกันออกซิเดชัน |\n| HM | HL + สารกันสึก (anti-wear) — ใช้มากที่สุดในโรงงาน |\n| HR | HL + ดัชนีความหนืดสูง |\n| HV | HM + ดัชนีความหนืดสูง สำหรับอุณหภูมิเปลี่ยนมาก |\n| HG | HM + กันกระตุก (stick-slip) สำหรับแท่นเลื่อน |\nคุณสมบัติที่กำหนด: ความหนืดตามเกรด ISO VG · ดัชนีความหนืด · จุดไหลเท · จุดวาบไฟ · กันสนิม · การกัดกร่อนทองแดง · การเกิดฟอง · การปล่อยอากาศ · การแยกตัวจากน้ำ · ความเสถียรต่อออกซิเดชัน · การกรองผ่านไส้กรอง\nHM/HV: ต้องผ่านการทดสอบการรับโหลดของเกียร์ (FZG) และการกันสึกของปั๊ม\nการนำไปใช้: ระบุประเภทและเกรดตอนจัดซื้อ (เช่น HM 46) และใช้เป็นค่าอ้างอิงของน้ำมันใหม่\n## ใช้ในงาน UGT\nใช้ตอน: จัดซื้อหรือเปลี่ยนยี่ห้อน้ำมันไฮดรอลิก\nในระบบ: เครื่องประเภท Hydraulic Unit · ช่องยี่ห้อน้ำมันและ VG ที่หน้าฐานข้อมูลเครื่องจักร\n## ข้อมูลเอกสาร\nแทนที่ฉบับ: ISO 11158:1997\nสถานะ: ใช้อยู่", tags: ["Hydraulic Fluids", "Family H", "Anti-Wear HM", "ISO VG 15–100"], version: 1, updated_at: "2026-04-05T08:00:00Z", updated_by: "system", related_params: ["visc", "water"], asset_types: ["Reciprocating Pump", "Screw Compressor"], related_standard_ids: [] },
    { id: "std-7", category: "TRIBOLOGY", title: "ISO 12925-1:2018", subtitle: "Lubricants — Specifications for family C (gears) — Part 1: Lubricating oils", description: "ข้อกำหนดน้ำมันเกียร์อุตสาหกรรม CKB/CKC/CKD (เกียร์ขนาน/เอียง/เฟืองตัวหนอน) — ความหนืด ISO VG 68–680, FZG Load Stage และคุณสมบัติเชิงกล", full_text: "ขอบเขต: ข้อกำหนดน้ำมันเกียร์อุตสาหกรรมแบบปิด กลุ่ม C\nประเภท: เลือกให้ตรงกับงาน\n| ประเภท | การใช้งาน |\n| CKB | น้ำมันแร่ กันสนิม/ออกซิเดชัน โหลดเบา |\n| CKC | CKB + รับโหลดสูง (EP) — เกียร์อุตสาหกรรมทั่วไป |\n| CKD | CKC + ทนความร้อนสูงขึ้น |\n| CKE | เฟืองตัวหนอน (worm gear) |\n| CKSMP / CKTMP | น้ำมันสังเคราะห์ ใช้ช่วงอุณหภูมิกว้าง |\nคุณสมบัติที่กำหนด: ความหนืด ISO VG · ดัชนีความหนืด · จุดไหลเท · กันสนิม · การกัดกร่อนทองแดง · การเกิดฟอง · การแยกตัวจากน้ำ · ความเสถียรต่อออกซิเดชัน · การรับโหลดของเกียร์ (FZG)\nการนำไปใช้: เทียบประเภทกับที่ผู้ผลิตเกียร์กำหนด และใช้ร่วมกับ AGMA 9005 ในการเลือกความหนืด\n## ใช้ในงาน UGT\nใช้ตอน: จัดซื้อหรือเทียบยี่ห้อน้ำมันเกียร์\nในระบบ: Gearbox และ Motor Gearbox · ช่องยี่ห้อน้ำมันและ VG ที่หน้าฐานข้อมูลเครื่องจักร\n## ข้อมูลเอกสาร\nแทนที่ฉบับ: ISO 12925-1:1996\nสถานะ: ใช้อยู่", tags: ["Gear Oils CKC/CKD", "FZG Load Stage", "ISO VG 68–680"], version: 1, updated_at: "2026-04-12T08:00:00Z", updated_by: "system", related_params: ["visc", "fe", "water"], asset_types: ["Gearbox", "Motor Gearbox", "Belt Conveyor"], related_standard_ids: [] },
    { id: "std-8", category: "TRIBOLOGY", title: "ISO 8068:2006", subtitle: "Lubricants — Specifications for family T (turbines) — Part 1: Turbine oils", description: "ข้อกำหนดน้ำมันเทอร์ไบน์ TSA/TSG/TSE — ISO VG 32/46/68, RPVOT, TAN, Demulsibility และ Air Release — ใช้อ้างอิงการเปลี่ยนถ่ายน้ำมันเทอร์ไบน์", full_text: "ขอบเขต: ข้อกำหนดน้ำมันเทอร์ไบน์กลุ่ม T (ไอน้ำ ก๊าซ และไฮดรอลิกควบคุม)\nประเภท: เลือกให้ตรงกับงาน\n| ประเภท | การใช้งาน |\n| TSA | กังหันไอน้ำ ทั่วไป |\n| TSE | กังหันไอน้ำที่มีเกียร์ ต้องรับโหลด (EP) |\n| TGA / TGB | กังหันก๊าซ (TGB ทนอุณหภูมิสูงกว่า) |\n| TGE / TGF | กังหันก๊าซที่มีเกียร์ |\nเกรดความหนืด: ISO VG 32, 46, 68\nคุณสมบัติที่กำหนด: ความเสถียรต่อออกซิเดชัน (TOST, RPVOT) · TAN · การแยกตัวจากน้ำ · การปล่อยอากาศ · การเกิดฟอง · กันสนิม · ความสะอาด\nการนำไปใช้: ใช้เป็นค่าอ้างอิงตอนรับน้ำมันใหม่ แล้วติดตามระหว่างใช้งานตาม ASTM D4378\n## ใช้ในงาน UGT\nใช้ตอน: รับน้ำมันเทอร์ไบน์ใหม่ — ส่งตัวอย่างน้ำมันใหม่ตรวจเก็บไว้เป็นค่าอ้างอิง\nในระบบ: เครื่องประเภท Steam Turbine · ติดตามระหว่างใช้งานตาม ASTM D4378\n## ข้อมูลเอกสาร\nสถานะ: ใช้อยู่", tags: ["Turbine Oils TSA/TSE", "RPVOT", "ISO VG 32–68"], version: 1, updated_at: "2026-04-19T08:00:00Z", updated_by: "system", related_params: ["tan", "visc", "water"], asset_types: ["Steam Turbine"], related_standard_ids: [] },
    { id: "std-9", category: "TRIBOLOGY", title: "ASTM D445-21", subtitle: "Standard Test Method for Kinematic Viscosity of Transparent and Opaque Liquids", description: "วิธีมาตรฐานวัดความหนืดจลน์ (Kinematic Viscosity) ด้วย Capillary Viscometer ที่ 40°C/100°C — หน่วย mm²/s (cSt) — ใช้ตรวจการเสื่อม/ปนเปื้อนน้ำมัน", full_text: "หลักการ: วัดเวลาที่น้ำมันไหลผ่านหลอดแก้ว (capillary viscometer) ในอ่างควบคุมอุณหภูมิ คูณค่าคงที่ของหลอด = ความหนืดจลน์ (mm²/s = cSt)\nอุณหภูมิทดสอบ: 40°C ใช้กำหนดเกรด ISO VG · 100°C ใช้ร่วมกับ 40°C คำนวณดัชนีความหนืด (ASTM D2270)\nช่วงเกรด ISO VG (ISO 3448): ค่ากลาง ±10% ที่ 40°C\n| ISO VG | ต่ำสุด (cSt) | ค่ากลาง (cSt) | สูงสุด (cSt) |\n| VG 22 | 19.8 | 22 | 24.2 |\n| VG 32 | 28.8 | 32 | 35.2 |\n| VG 46 | 41.4 | 46 | 50.6 |\n| VG 68 | 61.2 | 68 | 74.8 |\n| VG 100 | 90 | 100 | 110 |\n| VG 150 | 135 | 150 | 165 |\n| VG 220 | 198 | 220 | 242 |\n| VG 320 | 288 | 320 | 352 |\n| VG 460 | 414 | 460 | 506 |\n| VG 680 | 612 | 680 | 748 |\nการแปลผล: หนืดขึ้น = ออกซิเดชัน เขม่า หรือเติมผิดเกรด (สูงกว่า) · หนืดลง = เติมผิดเกรด (ต่ำกว่า) ปนเชื้อเพลิง/ตัวทำละลาย หรือสารเพิ่มดัชนีความหนืดถูกเฉือน\n## ใช้ในงาน UGT\nใช้ตอน: อ่านผลความหนืดจากแลบ\nในระบบ: ช่องความหนืด (cSt ที่ 40°C) ที่หน้าป้อนข้อมูล ระบบเทียบกับเกรด VG ของเครื่อง\nข้อควรระวัง: ต้องเป็นค่าที่ 40°C — ถ้าแลบส่งค่าที่ 100°C มาจะเทียบเกรดไม่ได้\n## ข้อมูลเอกสาร\nสถานะ: ASTM ทบทวนฉบับทุกไม่เกิน 5 ปี — ตรวจปีฉบับล่าสุดก่อนอ้างอิง", tags: ["Kinematic Viscosity", "Capillary Viscometer", "mm²/s (cSt)"], version: 1, updated_at: "2026-05-03T08:00:00Z", updated_by: "system", related_params: ["visc"], asset_types: ["Steam Turbine", "Gearbox", "Motor Gearbox", "Reciprocating Pump"], related_standard_ids: ["std-2", "std-8"] },
    { id: "std-10", category: "TRIBOLOGY", title: "ASTM D664-19", subtitle: "Standard Test Method for Acid Number of Petroleum Products by Potentiometric Titration", description: "วิธีวัด Total Acid Number (TAN) ด้วยการไทเทรตแบบ Potentiometric — หน่วย mg KOH/g — ใช้ติดตามการเกิดออกซิเดชันของน้ำมันหล่อลื่น", full_text: "หลักการ: ไทเทรตตัวอย่างด้วย KOH ในแอลกอฮอล์ วัดจุดยุติด้วยอิเล็กโทรด (potentiometric) ผล = mg KOH/g\nวิธีทดสอบ: Method A สำหรับผลิตภัณฑ์ปิโตรเลียมและน้ำมันหล่อลื่น · วิธีทางเลือกใช้สารบอกสี (ASTM D974)\nการแปลผล: TAN เพิ่มขึ้นจากค่าน้ำมันใหม่ = มีกรดจากออกซิเดชันหรือปนเปื้อน · น้ำมันที่มีสารเติมแต่งบางชนิดมี TAN เริ่มต้นสูงอยู่แล้ว จึงต้องดูที่การเปลี่ยนแปลงจากค่าน้ำมันใหม่\nใช้ร่วมกับ: RPVOT (ASTM D2272) วัดสารกันออกซิเดชันที่เหลือ · MPC (ASTM D7843) วัดตะกอนวานิช\n## ใช้ในงาน UGT\nใช้ตอน: อ่านผล TAN จากแลบ\nในระบบ: ช่อง TAN ที่หน้าป้อนข้อมูล · ดูแนวโน้มในหน้ารายละเอียดเครื่อง\nข้อควรระวัง: เทียบกับค่าน้ำมันใหม่ยี่ห้อเดียวกัน ไม่ใช่ตัวเลขเดียวสำหรับทุกน้ำมัน\n## ข้อมูลเอกสาร\nสถานะ: ASTM ทบทวนฉบับทุกไม่เกิน 5 ปี — ตรวจปีฉบับล่าสุดก่อนอ้างอิง", tags: ["TAN mg KOH/g", "Potentiometric Titration", "Oxidation Monitoring"], version: 1, updated_at: "2026-05-10T08:00:00Z", updated_by: "system", related_params: ["tan"], asset_types: ["Steam Turbine", "Gearbox", "Motor Gearbox"], related_standard_ids: [] },
    { id: "std-11", category: "VIBRATION", title: "ISO 13373-1:2002", subtitle: "Condition monitoring — Vibration condition monitoring — Part 1: General procedures", description: "แนวทางจัดทำโปรแกรมวัดการสั่นสะเทือน: จุดวัด (Bearing Housing H/V/A), ชนิดเซนเซอร์ (Accelerometer), ความถี่ตัวอย่าง และแผนการวัดที่สม่ำเสมอ", full_text: "ขอบเขต: ขั้นตอนทั่วไปของโปรแกรมตรวจสภาพด้วยการสั่นสะเทือน\nชนิดการวัด: การสั่นของตัวเรือน (absolute) ด้วย accelerometer หรือ velocity sensor · การสั่นของเพลาเทียบตัวเรือน (relative) ด้วย proximity probe\nจุดวัด: ตัวเรือนแบริ่งด้าน DE และ NDE ทิศ H/V/A · ทำเครื่องหมายจุดวัดให้วัดตำแหน่งเดิมทุกครั้ง\nการติดเซนเซอร์: แบบสกรู (stud) ได้ช่วงความถี่กว้างสุด · แม่เหล็ก · ถือมือ ได้ช่วงความถี่แคบสุด\nการเก็บข้อมูล: เก็บค่าฐานหลังติดตั้งหรือซ่อม แล้ววัดเป็นรอบ (หรือต่อเนื่องสำหรับเครื่องสำคัญ) ที่สภาวะการเดินเครื่องใกล้เคียงกัน\n## ใช้ในงาน UGT\nใช้ตอน: กำหนดจุดวัดและรอบวัดสั่น\nในระบบ: ผล Velocity และ Acceleration ป้อนที่หน้าป้อนข้อมูล\nข้อควรระวัง: วัดจุดเดิม ทิศเดิม และวิธีติดเซนเซอร์เดิมทุกครั้ง กราฟแนวโน้มจึงเทียบกันได้\n## ข้อมูลเอกสาร\nสถานะ: ใช้อยู่", tags: ["Measurement Points DE/NDE", "Accelerometer", "Vibration Program"], version: 1, updated_at: "2026-05-17T08:00:00Z", updated_by: "system", related_params: ["vel", "acc", "cf"], asset_types: ["Motor", "Reciprocating Pump", "Steam Turbine", "Gearbox", "Motor Gearbox"], related_standard_ids: [] },
    { id: "std-12", category: "VIBRATION", title: "ISO 13373-2:2016", subtitle: "Condition monitoring — Vibration condition monitoring — Part 2: Processing, analysis and presentation of vibration data", description: "แนวทางประมวลผล/วิเคราะห์ข้อมูลสั่นสะเทือน: time domain (RMS/Peak/Crest Factor), FFT spectrum, envelope analysis และการนำเสนอแนวโน้ม", full_text: "ขอบเขต: การประมวลผล วิเคราะห์ และนำเสนอข้อมูลการสั่นสะเทือน\nโดเมนเวลา: รูปคลื่น (time waveform) · ค่า RMS และ Peak · Crest Factor (Peak/RMS) ช่วยจับแรงกระแทกจากแบริ่ง\nโดเมนความถี่: FFT spectrum ดูยอดที่ 1×, 2×, n× rpm และความถี่ความเสียหายของแบริ่ง · ตั้งค่า resolution, window และ averaging ให้เหมาะ\nเทคนิคเพิ่มเติม: Envelope (demodulation) แยกสัญญาณแบริ่งระยะเริ่มต้น · Phase และ Orbit ช่วยแยก unbalance/misalignment\nการนำเสนอ: กราฟแนวโน้ม (trend) · spectrum เทียบค่าฐาน · waterfall ตอนเปลี่ยนความเร็ว\n## ใช้ในงาน UGT\nใช้ตอน: วิเคราะห์สาเหตุเมื่อค่าสั่นสูง\nในระบบ: ค่า Acceleration และ Crest Factor ที่หน้าป้อนข้อมูล · spectrum วิเคราะห์ในโปรแกรมของเครื่องวัด\n## ข้อมูลเอกสาร\nแทนที่ฉบับ: ISO 13373-2:2005\nสถานะ: ใช้อยู่", tags: ["FFT Spectrum", "Crest Factor", "Envelope Analysis", "Trend Analysis"], version: 1, updated_at: "2026-05-24T08:00:00Z", updated_by: "system", related_params: ["vel", "acc", "cf"], asset_types: ["Motor", "Gearbox", "Motor Gearbox", "Reciprocating Compressor"], related_standard_ids: ["std-11"] },
    { id: "std-13", category: "VIBRATION", title: "ISO 20816-1:2016", subtitle: "Mechanical vibration — Measurement and evaluation of machine vibration — Part 1: General guidelines", description: "มาตรฐานหลัก (แทน ISO 10816-1) สำหรับการวัด/ประเมินการสั่นสะเทือนเครื่องจักร 120–15,000 rpm ด้วย Velocity RMS แบ่งโซน A–D — ใช้อ้างอิงเกณฑ์ร่วมกับ ISO 20816-3", full_text: "ขอบเขต: หลักการทั่วไปในการวัดและประเมินการสั่นสะเทือนของเครื่องจักร (แทน ISO 10816-1 และ ISO 7919-1)\nเกณฑ์ข้อ 1: ขนาดการสั่น เทียบโซน A–D ตามส่วนของมาตรฐานที่ใช้กับเครื่องนั้น (เช่น Part 3)\nเกณฑ์ข้อ 2: การเปลี่ยนแปลงจากค่าฐาน แม้ยังไม่ถึงโซน C · ถ้าเปลี่ยนเกิน 25% ของขอบ B/C ควรหาสาเหตุ\nขีดจำกัดการเดินเครื่อง: ALARM เตือนให้ตรวจสอบ · TRIP หยุดเครื่องเมื่อเดินต่อจะเสียหาย\nการรายงาน: ระบุตำแหน่ง ทิศทาง ชนิดเซนเซอร์ ช่วงความถี่ และสภาวะเดินเครื่อง (โหลด ความเร็ว อุณหภูมิ)\n## ใช้ในงาน UGT\nใช้ตอน: วางหลักการตั้งเกณฑ์เตือนการสั่นสะเทือน\nในระบบ: หน้าตั้งค่าแจ้งเตือน (เกณฑ์ค่าสูงสุด) · กราฟแนวโน้มในหน้ารายละเอียดเครื่อง (ดูการเปลี่ยนแปลงจากค่าฐาน)\n## ข้อมูลเอกสาร\nแทนที่ฉบับ: ISO 10816-1:1995 · ISO 7919-1:1996\nสถานะ: ใช้อยู่", tags: ["Velocity RMS", "Zone A–D", "120–15,000 rpm"], version: 1, updated_at: "2026-06-01T08:00:00Z", updated_by: "system", related_params: ["vel", "acc"], asset_types: ["Motor", "Reciprocating Pump", "Screw Compressor"], related_standard_ids: ["std-3"] },
    { id: "std-14", category: "RELIABILITY", title: "ISO 13379-1:2012", subtitle: "Condition monitoring — Data interpretation and diagnostics techniques — Part 1: General guidelines", description: "แนวทางวินิจฉัยสภาพเครื่องจักรจากข้อมูล CM: ตรวจจับความผิดปกติ → ระบุอาการ → เทียบกับ failure mode → วินิจฉัยสาเหตุ → แนะนำการแก้ไข (ตรงกับโมดูล RCA/Diagnostic ของระบบ)", full_text: "ขอบเขต: แนวทางแปลผลข้อมูลตรวจสภาพและวินิจฉัยสาเหตุ\nขั้นตอน: ตรวจพบความผิดปกติ → ระบุอาการ → จับคู่อาการกับ failure mode → วินิจฉัยสาเหตุ → แนะนำการแก้ไข\nวิธีวินิจฉัย: แบบใช้ความรู้ (เช่น FMSA ตารางความสัมพันธ์ failure mode กับอาการ) · แบบใช้ข้อมูล (สถิติ โมเดลจากข้อมูลย้อนหลัง)\nความเชื่อมั่น: ประเมินระดับความมั่นใจของการวินิจฉัย และใช้หลายเทคนิคร่วมกัน (น้ำมัน + สั่นสะเทือน + สมรรถนะ) เพื่อลดความคลุมเครือ\n## ใช้ในงาน UGT\nใช้ตอน: วินิจฉัยเมื่อเครื่องขึ้นสถานะเฝ้าระวังหรือวิกฤต\nในระบบ: แถบสาเหตุหลักและ AI Diagnostic ในหน้ารายละเอียดเครื่อง ใช้ขั้นตอนเดียวกัน: อาการ → failure mode → สาเหตุ → คำแนะนำ\n## ข้อมูลเอกสาร\nแทนที่ฉบับ: ISO 13379:2003\nสถานะ: ใช้อยู่", tags: ["Diagnostic Process", "Root Cause Analysis", "Data Interpretation"], version: 1, updated_at: "2026-06-08T08:00:00Z", updated_by: "system", related_params: ["fe", "vel", "acc", "water", "tan"], asset_types: ["Reciprocating Pump", "Motor", "Steam Turbine", "Gearbox", "Motor Gearbox"], related_standard_ids: [] },
    { id: "std-15", category: "RELIABILITY", title: "ISO 14224:2016", subtitle: "Petroleum, petrochemical and natural gas industries — Collection and exchange of reliability and maintenance data", description: "มาตรฐานการเก็บ/แลกเปลี่ยนข้อมูลความน่าเชื่อถือ (RCM): Taxonomy เครื่องจักร, Failure Mode Taxonomy, การจัดลำดับความสำคัญ (criticality) และการคำนวณ MTBF", full_text: "ขอบเขต: การเก็บและแลกเปลี่ยนข้อมูลความน่าเชื่อถือและการบำรุงรักษา\nลำดับชั้นเครื่องจักร (taxonomy): อุตสาหกรรม → โรงงาน → หน่วยผลิต → ระบบ → เครื่องจักร → ชุดย่อย → ชิ้นส่วนที่ซ่อมได้\nข้อมูลความเสียหาย: failure mode · กลไก · สาเหตุ · วิธีตรวจพบ · ผลกระทบ\nข้อมูลการบำรุงรักษา: ประเภทงาน (แก้ไข/ป้องกัน) · ชั่วโมงงาน · เวลาหยุดเครื่อง\nตัวชี้วัด: MTBF = เวลาเดินเครื่อง ÷ จำนวนครั้งที่เสีย · อัตราความเสียหาย · ความพร้อมใช้งาน\n## ใช้ในงาน UGT\nใช้ตอน: ตั้งรหัสและโครงสร้างเครื่อง · บันทึกความเสียหาย\nในระบบ: รหัส TAG และการแยกจุดหล่อลื่น (เช่น Gear Box / Oil Tank) ในหน้าฐานข้อมูลเครื่องจักร\n## ข้อมูลเอกสาร\nแทนที่ฉบับ: ISO 14224:2006\nสถานะ: ใช้อยู่", tags: ["RCM Taxonomy", "Failure Mode Taxonomy", "MTBF", "Criticality Ranking"], version: 1, updated_at: "2026-06-15T08:00:00Z", updated_by: "system", related_params: ["fe", "vel", "acc"], asset_types: ["Reciprocating Pump", "Steam Turbine"], related_standard_ids: [] },
    { id: "std-16", category: "RELIABILITY", title: "IEC 60812:2018", subtitle: "Failure modes and effects analysis (FMEA and FMECA)", description: "แนวทางทำ FMEA/FMECA: ระบุ failure mode, ผลกระทบ, สาเหตุ และจัดลำดับความเสี่ยงด้วย RPN (Severity × Occurrence × Detection) — ฐานของการวิเคราะห์ RCA", full_text: "ขอบเขต: วิธีทำ FMEA และ FMECA สำหรับระบบ เครื่องจักร และกระบวนการ\nขั้นตอน: วางแผนและกำหนดขอบเขต → แยกโครงสร้างระบบ → ระบุ failure mode → ผลกระทบและสาเหตุ → มาตรการควบคุมที่มีอยู่ → ประเมินความสำคัญ → กำหนดการแก้ไข → บันทึกผล\nการจัดลำดับ: RPN = Severity × Occurrence × Detection หรือ ตารางความเสี่ยง (criticality matrix) · ฉบับ 2018 เตือนว่า RPN เท่ากันอาจมีความเสี่ยงไม่เท่ากัน ควรดู Severity ประกอบเสมอ\nการนำไปใช้: ใช้เลือกว่าเครื่องใดต้องตรวจสภาพด้วยเทคนิคใด และเป็นข้อมูลตั้งต้นของ RCA\n## ใช้ในงาน UGT\nใช้ตอน: จัดลำดับว่าเครื่องใดต้องเข้าโปรแกรมตรวจสภาพก่อน\nในระบบ: เลือกเครื่องที่ส่งวิเคราะห์น้ำมันและกำหนดรอบเก็บตัวอย่างในหน้าฐานข้อมูลเครื่องจักร\n## ข้อมูลเอกสาร\nแทนที่ฉบับ: IEC 60812:2006\nสถานะ: ใช้อยู่", tags: ["FMEA/FMECA", "RPN Score", "Severity × Occurrence × Detection"], version: 1, updated_at: "2026-06-22T08:00:00Z", updated_by: "system", related_params: ["fe", "vel", "acc"], asset_types: ["Motor", "Gearbox", "Motor Gearbox", "Reciprocating Compressor", "Mechanical Agitator"], related_standard_ids: [] },
  ];
}

// Oil analysis data from Excel (June, July, August 2026)
const OIL_HISTORY_DATA: Record<string, Array<{
  period: string; fe: number | null; cu: number | null; si: number | null;
  water: number | null; visc: number | null; tan: number | null;
  iso_code: string | null; particle_4: number | null; particle_6: number | null; particle_14: number | null;
}>> = {
  "12-P11": [
    { period: "2026-04", fe: 30, cu: 4, si: 8, water: 40, visc: 222, tan: 0.4, iso_code: "22.0/16.0/15.0", particle_4: 12000, particle_6: 450, particle_14: 10 },
    { period: "2026-05", fe: 35, cu: 5, si: 9, water: 42, visc: 226, tan: 0.5, iso_code: "22.5/16.2/15.2", particle_4: 12500, particle_6: 470, particle_14: 10 },
    { period: "2026-06", fe: 40, cu: 6, si: 10, water: 45, visc: 230, tan: 0.6, iso_code: "22.8/16.4/15.5", particle_4: 13000, particle_6: 490, particle_14: 11 },
    { period: "2026-07", fe: 45, cu: 7, si: 11, water: 48, visc: 236, tan: 0.9, iso_code: "23.0/16.5/15.7", particle_4: 13500, particle_6: 510, particle_14: 11 },
    { period: "2026-08", fe: 50, cu: 8, si: 12, water: 50, visc: 245, tan: 1.53, iso_code: "23.2/16.6/15.8", particle_4: 14000, particle_6: 530, particle_14: 12 },
  ],
  "2400-K03": [
    { period: "2026-04", fe: 15, cu: 3, si: 7, water: 30, visc: 66.5, tan: 0.2, iso_code: "15.0/13.0/11.0", particle_4: 3200, particle_6: 260, particle_14: 6 },
    { period: "2026-05", fe: 18, cu: 3, si: 8, water: 32, visc: 66.8, tan: 0.2, iso_code: "15.2/13.1/10.9", particle_4: 3400, particle_6: 270, particle_14: 6 },
    { period: "2026-06", fe: 45, cu: 5, si: 9, water: 35, visc: 67, tan: 0.3, iso_code: "15.9/13.1/10.8", particle_4: 3800, particle_6: 285, particle_14: 6 },
    { period: "2026-07", fe: 80, cu: 7, si: 10, water: 38, visc: 67.2, tan: 0.3, iso_code: "15.5/13.2/10.9", particle_4: 3600, particle_6: 290, particle_14: 7 },
    { period: "2026-08", fe: 150, cu: 10, si: 12, water: 40, visc: 67.4, tan: 0.3, iso_code: "15.7/13.3/11.0", particle_4: 4000, particle_6: 300, particle_14: 7 },
  ],
  "33-A06 (Gearbox)": [
    { period: "2026-04", fe: 25, cu: 5, si: 10, water: 45, visc: 146, tan: 0.2, iso_code: "19.5/14.5/11.5", particle_4: 8000, particle_6: 350, particle_14: 8 },
    { period: "2026-05", fe: 35, cu: 6, si: 11, water: 48, visc: 145.8, tan: 0.4, iso_code: "19.8/14.6/11.8", particle_4: 8500, particle_6: 370, particle_14: 9 },
    { period: "2026-06", fe: 50, cu: 8, si: 13, water: 50, visc: 145.5, tan: 0.7, iso_code: "20.4/14.7/12.2", particle_4: 9500, particle_6: 400, particle_14: 10 },
    { period: "2026-07", fe: 70, cu: 10, si: 15, water: 52, visc: 145.3, tan: 1.2, iso_code: "20.5/14.8/12.3", particle_4: 10000, particle_6: 430, particle_14: 10 },
    { period: "2026-08", fe: 90, cu: 12, si: 17, water: 55, visc: 145, tan: 1.53, iso_code: "20.8/15.0/12.5", particle_4: 11000, particle_6: 460, particle_14: 11 },
  ],
  "2400-K04": [
    { period: "2026-04", fe: 12, cu: 3, si: 6, water: 30, visc: 66.5, tan: 0.3, iso_code: "13.8/12.2/10.5", particle_4: 2500, particle_6: 200, particle_14: 4 },
    { period: "2026-05", fe: 13, cu: 3, si: 6, water: 32, visc: 66.8, tan: 0.3, iso_code: "13.9/12.3/10.6", particle_4: 2600, particle_6: 210, particle_14: 4 },
    { period: "2026-06", fe: 14, cu: 4, si: 7, water: 33, visc: 67, tan: 0.4, iso_code: "14.0/12.4/10.8", particle_4: 2700, particle_6: 220, particle_14: 4 },
    { period: "2026-07", fe: 15, cu: 4, si: 7, water: 34, visc: 67.2, tan: 0.4, iso_code: "14.1/12.5/10.9", particle_4: 2800, particle_6: 230, particle_14: 5 },
    { period: "2026-08", fe: 14, cu: 4, si: 7, water: 35, visc: 67, tan: 0.4, iso_code: "14.2/12.5/11.0", particle_4: 2900, particle_6: 240, particle_14: 5 },
  ],
  "33-A04 (Gearbox)": [
    { period: "2026-04", fe: 10, cu: 3, si: 7, water: 40, visc: 146, tan: 0.3, iso_code: "16.0/13.0/11.0", particle_4: 3500, particle_6: 280, particle_14: 6 },
    { period: "2026-05", fe: 12, cu: 3, si: 8, water: 42, visc: 146.5, tan: 0.4, iso_code: "16.2/13.2/10.9", particle_4: 3600, particle_6: 290, particle_14: 6 },
    { period: "2026-06", fe: 15, cu: 4, si: 8, water: 43, visc: 147, tan: 0.5, iso_code: "16.4/13.3/10.8", particle_4: 3800, particle_6: 300, particle_14: 6 },
    { period: "2026-07", fe: 14, cu: 4, si: 9, water: 44, visc: 146.8, tan: 0.5, iso_code: "16.3/13.2/10.9", particle_4: 3700, particle_6: 295, particle_14: 6 },
    { period: "2026-08", fe: 13, cu: 4, si: 9, water: 45, visc: 147, tan: 0.5, iso_code: "16.5/13.4/11.0", particle_4: 3900, particle_6: 310, particle_14: 7 },
  ],
  "33-A05 (Gearbox)": [
    { period: "2026-04", fe: 8, cu: 2, si: 6, water: 35, visc: 145, tan: 0.2, iso_code: "15.5/11.5/10.5", particle_4: 3000, particle_6: 240, particle_14: 5 },
    { period: "2026-05", fe: 10, cu: 3, si: 7, water: 36, visc: 145.5, tan: 0.3, iso_code: "15.6/11.5/10.6", particle_4: 3100, particle_6: 250, particle_14: 5 },
    { period: "2026-06", fe: 12, cu: 3, si: 7, water: 37, visc: 146, tan: 0.4, iso_code: "15.7/11.6/10.8", particle_4: 3200, particle_6: 260, particle_14: 5 },
    { period: "2026-07", fe: 11, cu: 3, si: 8, water: 38, visc: 146.5, tan: 0.4, iso_code: "15.8/11.7/10.9", particle_4: 3100, particle_6: 255, particle_14: 5 },
    { period: "2026-08", fe: 10, cu: 3, si: 8, water: 39, visc: 146, tan: 0.4, iso_code: "15.9/11.8/11.0", particle_4: 3300, particle_6: 270, particle_14: 6 },
  ],
  "331-A03 (Gear Reduce)": [
    { period: "2026-04", fe: 25, cu: 6, si: 10, water: 45, visc: 216.5, tan: 0.3, iso_code: "17.0/15.0/12.0", particle_4: 4200, particle_6: 340, particle_14: 8 },
    { period: "2026-05", fe: 28, cu: 6, si: 10, water: 46, visc: 216, tan: 0.3, iso_code: "17.2/15.0/12.2", particle_4: 4300, particle_6: 350, particle_14: 8 },
    { period: "2026-06", fe: 30, cu: 7, si: 11, water: 47, visc: 215.7, tan: 0.4, iso_code: "17.4/15.1/12.5", particle_4: 4500, particle_6: 360, particle_14: 8 },
    { period: "2026-07", fe: 28, cu: 7, si: 11, water: 48, visc: 215.5, tan: 0.4, iso_code: "17.3/15.0/12.4", particle_4: 4400, particle_6: 355, particle_14: 8 },
    { period: "2026-08", fe: 27, cu: 7, si: 11, water: 49, visc: 215.8, tan: 0.4, iso_code: "17.5/15.2/12.6", particle_4: 4600, particle_6: 370, particle_14: 9 },
  ],
  "03-U01A": [
    { period: "2026-06", fe: null, cu: null, si: null, water: 200, visc: 62.8, tan: 0, iso_code: "22.5/18.8/12.9", particle_4: null, particle_6: null, particle_14: 12 },
  ],
  "03-U01B": [
    { period: "2026-06", fe: null, cu: null, si: null, water: 200, visc: 78.8, tan: 0, iso_code: "16.6/13.6/11.4", particle_4: null, particle_6: 9, particle_14: null },
  ],
  "05-B11A": [
    { period: "2026-06", fe: null, cu: null, si: null, water: 200, visc: 127.5, tan: 0.7, iso_code: "17.5/13.3/11.0", particle_4: 7, particle_6: null, particle_14: null },
  ],
  "34-Z04A": [
    { period: "2026-06", fe: null, cu: null, si: null, water: null, visc: 27.4, tan: 0, iso_code: "19.2/15.4/13.6", particle_4: null, particle_6: null, particle_14: 12 },
  ],
  "34-Z04B": [
    { period: "2026-06", fe: null, cu: null, si: null, water: null, visc: 27.3, tan: 0.2, iso_code: "12.2/11.0/9.2", particle_4: 3, particle_6: null, particle_14: null },
  ],
  "4700-V05-A1": [
    { period: "2026-06", fe: null, cu: null, si: null, water: null, visc: 199.7, tan: 0.3, iso_code: "15.1/13.4/10.8", particle_4: 5, particle_6: null, particle_14: null },
  ],
  "4700-V08-A1": [
    { period: "2026-06", fe: null, cu: null, si: null, water: null, visc: 200, tan: 0.4, iso_code: "14.1/12.7/10.8", particle_4: 5, particle_6: null, particle_14: null },
  ],
  "33-A03A (Gearbox)": [
    { period: "2026-06", fe: null, cu: null, si: null, water: null, visc: 142.5, tan: 0.6, iso_code: "14.7/13.2/11.0", particle_4: null, particle_6: 9, particle_14: null },
  ],
  "33-A03B (Gearbox)": [
    { period: "2026-06", fe: null, cu: null, si: null, water: null, visc: 138.4, tan: 0.6, iso_code: "14.7/13.2/11.0", particle_4: null, particle_6: 9, particle_14: null },
  ],
  "06-K01B": [
    { period: "2026-07", fe: null, cu: null, si: null, water: null, visc: 61.7, tan: 0.3, iso_code: "23.0/20.8/17.1", particle_4: null, particle_6: null, particle_14: 12 },
  ],
  "4140-B01-T1 (oil system)": [
    { period: "2026-08", fe: null, cu: null, si: null, water: null, visc: 31.1, tan: 0, iso_code: "17.9/15.0/11.6", particle_4: 7, particle_6: null, particle_14: null },
  ],
  "52-M01": [
    { period: "2026-08", fe: null, cu: null, si: null, water: null, visc: 209, tan: null, iso_code: "22.1/18.3/12.9", particle_4: null, particle_6: null, particle_14: 12 },
  ],
  "52-M02": [
    { period: "2026-08", fe: null, cu: null, si: null, water: null, visc: 211.5, tan: null, iso_code: "15.9/14.0/10.8", particle_4: 5, particle_6: null, particle_14: null },
  ],
};

// Vibration history for the 5 Warning/Critical demo assets — velocity RMS
// (mm/s, warn 4.5 / crit 7.1) and peak acceleration (g-PK, warn 5 / crit 10)
// rise in step with each asset's oil-degradation trend above.
const VIB_HISTORY_DATA: Record<string, Array<{
  period: string; vel: number | null; acc: number | null; cf: number | null; temp: number | null;
}>> = {
  "12-P11": [
    { period: "2026-04", vel: 2.8, acc: 3.0, cf: 3.8, temp: 48 },
    { period: "2026-05", vel: 3.2, acc: 3.4, cf: 4.0, temp: 50 },
    { period: "2026-06", vel: 3.9, acc: 4.0, cf: 4.2, temp: 53 },
    { period: "2026-07", vel: 4.6, acc: 4.8, cf: 4.5, temp: 56 },
    { period: "2026-08", vel: 5.3, acc: 5.6, cf: 4.7, temp: 59 },
  ],
  "2400-K03": [
    { period: "2026-04", vel: 2.5, acc: 2.8, cf: 3.5, temp: 55 },
    { period: "2026-05", vel: 2.9, acc: 3.2, cf: 3.7, temp: 57 },
    { period: "2026-06", vel: 3.8, acc: 4.3, cf: 4.0, temp: 62 },
    { period: "2026-07", vel: 4.4, acc: 5.2, cf: 4.3, temp: 67 },
    { period: "2026-08", vel: 5.0, acc: 6.0, cf: 4.6, temp: 71 },
  ],
  "33-A06 (Gearbox)": [
    { period: "2026-04", vel: 2.6, acc: 2.9, cf: 3.6, temp: 44 },
    { period: "2026-05", vel: 3.0, acc: 3.3, cf: 3.8, temp: 46 },
    { period: "2026-06", vel: 3.7, acc: 4.1, cf: 4.1, temp: 50 },
    { period: "2026-07", vel: 4.5, acc: 5.0, cf: 4.5, temp: 55 },
    { period: "2026-08", vel: 5.4, acc: 6.2, cf: 4.9, temp: 60 },
  ],
};

export function getDemoOilHistory(assetId: string): OilReading[] {
  const base = OIL_HISTORY_DATA[assetId] || [];
  return isLocalStore() ? mergeHistory(base, getLocalOil(assetId)) : base;
}
export function getDemoVibHistory(assetId: string): VibReading[] {
  const base = VIB_HISTORY_DATA[assetId] || [];
  return isLocalStore() ? mergeHistory(base, getLocalVib(assetId)) : base;
}

// ── Maintenance history (demo), keyed by asset_id like OIL/VIB_HISTORY_DATA ──
const MAINTENANCE_DATA: Record<string, MaintenanceRecord[]> = {
  "12-P11": [
    { id: "MNT-19201", asset_id: "12-P11", type: "pm", work_date: "2026-03-12", wo_no: "19201", description: "PM เปลี่ยนถ่ายน้ำมันเกียร์บ็อกซ์", parts: "Gear Oil ISO VG320 x 8L", cost: 5100, technician: "Tech. Anan" },
    { id: "MNT-19202", asset_id: "12-P11", type: "cm", work_date: "2026-06-18", wo_no: "19202", description: "ปรับตั้งความตึงสายพานขับ", parts: "-", cost: 800, technician: "Tech. Boonsri" },
  ],
  "2400-K03": [
    { id: "MNT-19301", asset_id: "2400-K03", type: "pm", work_date: "2026-02-01", wo_no: "19301", description: "PM Oil Replacement (oil system)", parts: "Compressor Oil x 20L", cost: 15200, technician: "Tech. Chai" },
    { id: "MNT-19302", asset_id: "2400-K03", type: "cm", work_date: "2026-05-22", wo_no: "19302", description: "ทำความสะอาดตัวกรองอากาศเข้า", parts: "Air Filter Element", cost: 1200, technician: "Tech. Somchai" },
  ],
  "33-A06 (Gearbox)": [
    { id: "MNT-19501", asset_id: "33-A06 (Gearbox)", type: "pm", work_date: "2026-01-10", wo_no: "19501", description: "PM Replacement (Shaft Bearing)", parts: "Bearing 22218 x2", cost: 9800, technician: "Tech. Anan" },
    { id: "MNT-19502", asset_id: "33-A06 (Gearbox)", type: "pm", work_date: "2026-04-15", wo_no: "19502", description: "PM Oil Replacement and Flushing", parts: "Gear Oil ISO VG150 x 10L", cost: 6300, technician: "Tech. Boonsri" },
    { id: "MNT-19503", asset_id: "33-A06 (Gearbox)", type: "cm", work_date: "2026-07-08", wo_no: "19503", description: "ปรับตั้งใบพัดกวนที่หลวม", parts: "-", cost: 1100, technician: "Tech. Chai" },
  ],
  "1130-P09-A": [
    { id: "MNT-19601", asset_id: "1130-P09-A", type: "pm", work_date: "2026-02-01", wo_no: "19601", description: "เปลี่ยนถ่ายน้ำมันหล่อลื่นตามรอบ (bearing)", parts: "Grease x1kg", cost: 850, technician: "Tech. Somchai" },
  ],
  "1130-P13-A": [
    { id: "MNT-19602", asset_id: "1130-P13-A", type: "pm", work_date: "2026-03-15", wo_no: "19602", description: "PM Oil Replacement (bearing)", parts: "Grease x1kg", cost: 850, technician: "Tech. Wichai" },
  ],
  "2400-K04": [
    { id: "MNT-19701", asset_id: "2400-K04", type: "pm", work_date: "2026-02-08", wo_no: "19701", description: "PM Oil Replacement (oil system)", parts: "Compressor Oil x 20L", cost: 14800, technician: "Tech. Araya" },
    { id: "MNT-19702", asset_id: "2400-K04", type: "cm", work_date: "2026-05-12", wo_no: "19702", description: "ซ่อมระบบระบายความร้อน", parts: "Cooling Fan Motor", cost: 32500, technician: "Tech. Wichai" },
  ],
  "4700-B01-B": [
    { id: "MNT-19801", asset_id: "4700-B01-B", type: "pm", work_date: "2026-03-15", wo_no: "19801", description: "PM Oil Replacement (Gear)NDE", parts: "Gear Oil ISO VG150 x 4L", cost: 3100, technician: "Tech. Anan" },
    { id: "MNT-19802", asset_id: "4700-B01-B", type: "cm", work_date: "2026-06-15", wo_no: "19802", description: "ตรวจสอบค่าสั่นสะเทือนเฝ้าระวัง", parts: "-", cost: 500, technician: "Tech. Boonsri" },
  ],
  "2030-P01-A": [
    { id: "MNT-19901", asset_id: "2030-P01-A", type: "pm", work_date: "2026-01-01", wo_no: "19901", description: "PM Oil Replacement (bearing)", parts: "Grease x1kg", cost: 780, technician: "Tech. Chai" },
  ],
  "02-A02": [
    { id: "MNT-20001", asset_id: "02-A02", type: "pm", work_date: "2026-02-25", wo_no: "20001", description: "PM Oil Replacement (Cyclo Reduce)", parts: "Cyclo Oil x3L", cost: 1400, technician: "Tech. Somchai" },
  ],
  "03-U01C": [
    { id: "MNT-20101", asset_id: "03-U01C", type: "pm", work_date: "2026-03-05", wo_no: "20101", description: "PM Oil Replacement (Bulk Oil Separator)", parts: "Compressor Oil x15L", cost: 11200, technician: "Tech. Araya" },
  ],
  "01-B01-A": [
    { id: "MNT-20201", asset_id: "01-B01-A", type: "cm", work_date: "2026-05-20", wo_no: "20201", description: "ตรวจสอบความชื้นในน้ำมันหล่อลื่น", parts: "-", cost: 300, technician: "Tech. Wichai" },
  ],
  "1550-F1": [
    { id: "MNT-20301", asset_id: "1550-F1", type: "pm", work_date: "2026-01-20", wo_no: "20301", description: "ตรวจสอบระบบหล่อลื่นเตาเผา", parts: "Heat Transfer Oil x40L", cost: 22000, technician: "Tech. Anan" },
  ],
  "11-P01": [
    { id: "MNT-20401", asset_id: "11-P01", type: "cm", work_date: "2026-05-05", wo_no: "20401", description: "เปลี่ยนมอเตอร์ฉุกเฉิน", parts: "Motor 0.5kW", cost: 45000, technician: "Tech. Chai" },
  ],
};

// ── Public accessors ──
export function getDemoMaintenance(assetId: string): MaintenanceRecord[] { return MAINTENANCE_DATA[assetId] || []; }
