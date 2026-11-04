-- 0015_standards_more.sql
-- Standards library v3: add 11 more real international standards (oil analysis,
-- vibration, reliability) to complement the original 5. Runs after 0013
-- (adds version/updated_at/updated_by/related_params/asset_types columns).
-- Idempotent: skips any standard whose title already exists.
insert into public.standards (category, title, subtitle, description, full_text, tags, version, updated_at, updated_by, related_params, asset_types)
select 'TRIBOLOGY','ISO 11158:2009','Lubricants, industrial oils — Specifications for family H (hydraulic fluids)',
 'ข้อกำหนดคุณภาพน้ำมันไฮดรอลิกครอบครัว H (HH/HL/HM/HV/HG) ใช้กับระบบไฮดรอลิกโรงงาน — ครอบคลุมความหนืด ISO VG, Anti-Wear, Demulsibility และ Filterability',
 'ประเภท: HH (mineral) | HL (anti-oxidant/anti-rust) | HM (anti-wear) | HV (high VI) | HG (HM+anti-stick-slip)'||chr(10)||
 'HM: Viscosity ISO VG 15–100 | Demulsibility ≤ 30 นาที (54°C) | Filterability ไม่ตันกรอง',
 array['Hydraulic Fluids','Family H','Anti-Wear HM','ISO VG 15–100'], 1, now(), 'system', array['visc','water','si'], array['Reciprocating Pump','Screw Compressor']
where not exists (select 1 from public.standards where title = 'ISO 11158:2009');

insert into public.standards (category, title, subtitle, description, full_text, tags, version, updated_at, updated_by, related_params, asset_types)
select 'TRIBOLOGY','ISO 12925-1:2018','Lubricants — Specifications for family C (gears) — Part 1: Lubricating oils',
 'ข้อกำหนดน้ำมันเกียร์อุตสาหกรรม CKB/CKC/CKD (เกียร์ขนาน/เอียง/เฟืองตัวหนอน) — ความหนืด ISO VG 68–680, FZG Load Stage และคุณสมบัติเชิงกล',
 'CKB: โหลดปกติ ใช้กับเกียร์ FZG ≥ 9 | CKC: โหลดสูง (อุตสาหกรรม) FZG ≥ 11 | CKD: โหลดสูงมาก FZG ≥ 12'||chr(10)||
 'Viscosity ISO VG 68–680 | Demulsibility ≤ 60 นาที (82°C) | กันสนิม/เกิดฟองต่ำ',
 array['Gear Oils CKC/CKD','FZG Load Stage','ISO VG 68–680'], 1, now(), 'system', array['visc','fe','water'], array['Gearbox','Conveyor']
where not exists (select 1 from public.standards where title = 'ISO 12925-1:2018');

insert into public.standards (category, title, subtitle, description, full_text, tags, version, updated_at, updated_by, related_params, asset_types)
select 'TRIBOLOGY','ISO 8068:2006','Lubricants — Specifications for family T (turbines) — Part 1: Turbine oils',
 'ข้อกำหนดน้ำมันเทอร์ไบน์ TSA/TSG/TSE — ISO VG 32/46/68, RPVOT, TAN, Demulsibility และ Air Release — ใช้อ้างอิงการเปลี่ยนถ่ายน้ำมันเทอร์ไบน์',
 'TSA: mineral turbine oil | TSE: enhanced oxidation resistance'||chr(10)||
 'Viscosity ISO VG 32/46/68 | RPVOT ≥ กำหนดผู้ผลิต | TAN เพิ่ม > 0.3 mgKOH/g = เตือน'||chr(10)||
 'Demulsibility ≤ 30 นาที | Air Release ≤ 5 นาที (50°C)',
 array['Turbine Oils TSA/TSE','RPVOT','ISO VG 32–68'], 1, now(), 'system', array['tan','visc','water'], array['Turbine','Generator']
where not exists (select 1 from public.standards where title = 'ISO 8068:2006');

insert into public.standards (category, title, subtitle, description, full_text, tags, version, updated_at, updated_by, related_params, asset_types)
select 'TRIBOLOGY','ASTM D445-21','Standard Test Method for Kinematic Viscosity of Transparent and Opaque Liquids',
 'วิธีมาตรฐานวัดความหนืดจลน์ (Kinematic Viscosity) ด้วย Capillary Viscometer ที่ 40°C/100°C — หน่วย mm²/s (cSt) — ใช้ตรวจการเสื่อม/ปนเปื้อนน้ำมัน',
 'วัดที่ 40°C (ใช้งาน) และ 100°C (อุณหภูมิสูง) | ผล mm²/s (cSt)'||chr(10)||
 'Repeatability ≈ 0.11% | ความหนืดเปลี่ยน > ±5% จากค่า baseline = เตือน (ดู ASTM D4378/ISO 8068)',
 array['Kinematic Viscosity','Capillary Viscometer','mm²/s (cSt)'], 1, now(), 'system', array['visc'], array['Turbine','Gearbox','Reciprocating Pump']
where not exists (select 1 from public.standards where title = 'ASTM D445-21');

insert into public.standards (category, title, subtitle, description, full_text, tags, version, updated_at, updated_by, related_params, asset_types)
select 'TRIBOLOGY','ASTM D664-19','Standard Test Method for Acid Number of Petroleum Products by Potentiometric Titration',
 'วิธีวัด Total Acid Number (TAN) ด้วยการไทเทรตแบบ Potentiometric — หน่วย mg KOH/g — ใช้ติดตามการเกิดออกซิเดชันของน้ำมันหล่อลื่น',
 'TAN = mg KOH/g | ค่าเพิ่ม > 0.3 mgKOH/g จากค่าเริ่มต้น (baseline) = เตือนออกซิเดชัน'||chr(10)||
 'ใช้ร่วมกับ RPVOT/MPC (ASTM D2272/D7843) เพื่อยืนยันการเสื่อมของน้ำมัน',
 array['TAN mg KOH/g','Potentiometric Titration','Oxidation Monitoring'], 1, now(), 'system', array['tan'], array['Turbine','Gearbox','Generator']
where not exists (select 1 from public.standards where title = 'ASTM D664-19');

insert into public.standards (category, title, subtitle, description, full_text, tags, version, updated_at, updated_by, related_params, asset_types)
select 'VIBRATION','ISO 13373-1:2002','Condition monitoring — Vibration condition monitoring — Part 1: General procedures',
 'แนวทางจัดทำโปรแกรมวัดการสั่นสะเทือน: จุดวัด (Bearing Housing H/V/A), ชนิดเซนเซอร์ (Accelerometer), ความถี่ตัวอย่าง และแผนการวัดที่สม่ำเสมอ',
 'จุดวัด: Drive End (DE) + Non-Drive End (NDE) × ทิศทาง H/V/A'||chr(10)||
 'เซนเซอร์: Accelerometer ติดแบบ Stud/Bonded | ช่วงความถี่ตามความเร็วรอบ'||chr(10)||
 'แผนการวัด: baseline ชุดแรก แล้ววัดตามรอบ (weekly/monthly) เพื่อเปรียบเทียบแนวโน้ม',
 array['Measurement Points DE/NDE','Accelerometer','Vibration Program'], 1, now(), 'system', array['vel','acc','cf'], array['Electric Motor','Reciprocating Pump','Turbine','Gearbox']
where not exists (select 1 from public.standards where title = 'ISO 13373-1:2002');

insert into public.standards (category, title, subtitle, description, full_text, tags, version, updated_at, updated_by, related_params, asset_types)
select 'VIBRATION','ISO 13373-2:2016','Condition monitoring — Vibration condition monitoring — Part 2: Processing, analysis and presentation of vibration data',
 'แนวทางประมวลผล/วิเคราะห์ข้อมูลสั่นสะเทือน: time domain (RMS/Peak/Crest Factor), FFT spectrum, envelope analysis และการนำเสนอแนวโน้ม',
 'Time domain: RMS, Peak, Crest Factor (CF > 6 = สงสัย bearing defect)'||chr(10)||
 'Frequency domain: FFT spectrum ระบุความถี่ 1×/2×/n× RPM และ bearing fault frequency'||chr(10)||
 'Envelope/Spectrum analysis: แยกสัญญาณ bearing defect ออกจาก noise | Trend: เปรียบเทียบ baseline',
 array['FFT Spectrum','Crest Factor','Envelope Analysis','Trend Analysis'], 1, now(), 'system', array['vel','acc','cf'], array['Electric Motor','Gearbox','Reciprocating Compressor']
where not exists (select 1 from public.standards where title = 'ISO 13373-2:2016');

insert into public.standards (category, title, subtitle, description, full_text, tags, version, updated_at, updated_by, related_params, asset_types)
select 'VIBRATION','ISO 20816-1:2016','Mechanical vibration — Measurement and evaluation of machine vibration — Part 1: General guidelines',
 'มาตรฐานหลัก (แทน ISO 10816-1) สำหรับการวัด/ประเมินการสั่นสะเทือนเครื่องจักร 120–15,000 rpm ด้วย Velocity RMS แบ่งโซน A–D — ใช้อ้างอิงเกณฑ์ร่วมกับ ISO 10816-3',
 'วัด Velocity RMS (mm/s) ที่ Bearing Housing | เครื่องจักร 120–15,000 rpm'||chr(10)||
 'โซน: A (ใหม่) | B (ยอมรับได้ระยะยาว) | C (เฝ้าระวัง) | D (อันตราย)'||chr(10)||
 'ผลวิเคราะห์ต้องระบุ: ตำแหน่งวัด, ทิศทาง, สภาพเครื่อง (โหลด/อุณหภูมิ), คลาสเครื่องจักร',
 array['Velocity RMS','Zone A–D','120–15,000 rpm'], 1, now(), 'system', array['vel','acc'], array['Electric Motor','Reciprocating Pump','Screw Compressor','Generator']
where not exists (select 1 from public.standards where title = 'ISO 20816-1:2016');

insert into public.standards (category, title, subtitle, description, full_text, tags, version, updated_at, updated_by, related_params, asset_types)
select 'RELIABILITY','ISO 13379-1:2012','Condition monitoring — Data interpretation and diagnostics techniques — Part 1: General guidelines',
 'แนวทางวินิจฉัยสภาพเครื่องจักรจากข้อมูล CM: ตรวจจับความผิดปกติ → ระบุอาการ → เทียบกับ failure mode → วินิจฉัยสาเหตุ → แนะนำการแก้ไข (ตรงกับโมดูล RCA/Diagnostic ของระบบ)',
 'กระบวนการวินิจฉัย: Detect (ผิดปกติ?) → Identify (อาการอะไร?) → Compare (ตรง failure mode ใด?) → Diagnose (root cause) → Recommend (แนวทางแก้ไข)'||chr(10)||
 'ใช้ข้อมูลหลายแหล่งประกอบ: Vibration + Oil Analysis + Performance เพื่อลดความคลุมเครือ',
 array['Diagnostic Process','Root Cause Analysis','Data Interpretation'], 1, now(), 'system', array['fe','vel','acc','water','tan'], array['Reciprocating Pump','Electric Motor','Turbine','Gearbox']
where not exists (select 1 from public.standards where title = 'ISO 13379-1:2012');

insert into public.standards (category, title, subtitle, description, full_text, tags, version, updated_at, updated_by, related_params, asset_types)
select 'RELIABILITY','ISO 14224:2016','Petroleum, petrochemical and natural gas industries — Collection and exchange of reliability and maintenance data',
 'มาตรฐานการเก็บ/แลกเปลี่ยนข้อมูลความน่าเชื่อถือ (RCM): Taxonomy เครื่องจักร, Failure Mode Taxonomy, การจัดลำดับความสำคัญ (criticality) และการคำนวณ MTBF',
 'Taxonomy: Industry → Plant → Unit → Equipment → Sub-unit → Component (ใช้อ้างอิงโครงสร้าง asset)'||chr(10)||
 'Failure mode taxonomy มาตรฐาน (เช่น bearing failure, seal leakage) ใช้ร่วมกับ RCA'||chr(10)||
 'Criticality ranking: ผลกระทบต่อผลิต/ความปลอดภัย/สิ่งแวดล้อม | MTBF = operating time / failures',
 array['RCM Taxonomy','Failure Mode Taxonomy','MTBF','Criticality Ranking'], 1, now(), 'system', array['fe','cu','vel','acc'], array['Reciprocating Pump','Turbine','Generator']
where not exists (select 1 from public.standards where title = 'ISO 14224:2016');

insert into public.standards (category, title, subtitle, description, full_text, tags, version, updated_at, updated_by, related_params, asset_types)
select 'RELIABILITY','IEC 60812:2018','Failure modes and effects analysis (FMEA and FMECA)',
 'แนวทางทำ FMEA/FMECA: ระบุ failure mode, ผลกระทบ, สาเหตุ และจัดลำดับความเสี่ยงด้วย RPN (Severity × Occurrence × Detection) — ฐานของการวิเคราะห์ RCA',
 'ขั้นตอน: กำหนดขอบเขต → ระบุ failure mode → ผลกระทบ/สาเหตุ → มาตรการควบคุมที่มีอยู่'||chr(10)||
 'RPN = Severity × Occurrence × Detection (1–10 ต่อด้าน) | RPN สูง = ต้องแก้ไขก่อน'||chr(10)||
 'FMECA: เพิ่ม Criticality Analysis (ความถี่ × ผลกระทบ) สำหรับจัดลำดับทรัพยากรบำรุงรักษา',
 array['FMEA/FMECA','RPN Score','Severity × Occurrence × Detection'], 1, now(), 'system', array['fe','cu','vel','acc'], array['Electric Motor','Gearbox','Reciprocating Compressor','Agitator']
where not exists (select 1 from public.standards where title = 'IEC 60812:2018');
