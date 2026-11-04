-- =============================================================================
-- UGT Reliability Lubrication AI Platform v3
-- Seed data — run AFTER 0001_schema.sql
-- Contents: reference data (sites, asset_types), alarm defaults, standards x5.
--           (The prototype's 500 sample machines were dropped: the real machines
--           come from 0032_real_equipment.sql.)
-- =============================================================================

-- ---------- 1. sites (parity: UT, PCD, SA, TSL, NY1) ----------
insert into public.sites (code, name, sort_order) values
  ('UT',  'UT Plant',  1),
  ('PCD', 'PCD Plant', 2),
  ('SA',  'SA Plant',  3),
  ('TSL', 'TSL Plant', 4),
  ('NY1', 'NY1 Plant', 5)
on conflict (code) do nothing;

-- ---------- 2. asset types (parity: TYPES / ABBR / TC) ----------
insert into public.asset_types (name, abbr, color) values
  ('Reciprocating Pump',     'RE', '#0ea5e9'),
  ('Electric Motor',         'EL', '#7c3aed'),
  ('Turbine',                'TU', '#f59e0b'),
  ('Gearbox',                'GE', '#22c55e'),
  ('Reciprocating Compressor','RE', '#38bdf8'),
  ('Agitator',               'AG', '#a855f7'),
  ('Screw Compressor',       'SC', '#06b6d4'),
  ('Generator',              'GE', '#f97316'),
  ('Conveyor',               'CO', '#64748b'),
  ('Other',                  'OT', '#94a3b8')
on conflict (name) do nothing;

-- ---------- 3. alarm params defaults (parity: OIL_P / VIB_P) ----------
insert into public.alarm_params (category, key, name, unit, description, warn_limit, crit_limit) values
  ('oil','fe',     'Iron (Fe)',       'ppm',      'ปริมาณเหล็กจากการสึกหรอของเกียร์/แบริ่ง', 100, 200),
  ('oil','cu',     'Copper (Cu)',     'ppm',      'ทองแดงจาก Bearing Cage/Cooler',          20,  50),
  ('oil','si',     'Silicon (Si)',    'ppm',      'ฝุ่นและสิ่งสกปรก',                          15,  30),
  ('oil','water',  'Water Content',   'ppm',      'ความชื้นในน้ำมัน (ASTM D6304)',           500, 1000),
  ('oil','tan',    'TAN (mgKOH/g)',   'mgKOH/g',  'ค่าความเป็นกรดของน้ำมัน',                   0.5, 1.0),
  ('vib','vel',    'Velocity RMS',    'mm/s',     'ความเร็วแรงสั่นสะเทือน (ISO 10816-3)',     4.5, 7.1),
  ('vib','acc',    'Peak Acceleration','g-PK',    'ค่าความเร่งแรงสั่น (Impact/Bearing)',       5,   10)
on conflict (category, key) do nothing;

-- ---------- 4. standards x5 (parity: STDS in prototype) ----------
insert into public.standards (category, title, subtitle, description, full_text, tags) values
(
 'TRIBOLOGY','ISO 4406:2021','Method for Coding the Level of Contamination by Solid Particles',
 'มาตรฐานสากลหลักสำหรับการรายงานระดับความสะอาดของของเหลวไฮดรอลิกและน้ำมันหล่อลื่น โดยใช้รหัสสามส่วน (เช่น 18/16/13) แทนจำนวนอนุภาคต่อ 1 mL ที่มีขนาดใหญ่กว่า 4μm(c), 6μm(c) และ 14μm(c)',
 'ขอบเขต: ISO 4406:2021 กำหนดวิธีการแสดงผลระดับการปนเปื้อนของอนุภาคแข็งในของเหลวที่ใช้ในระบบไฮดรอลิกและระบบหล่อลื่น โดยอาศัยการนับอนุภาคด้วย Particle Counter แบบ Automatic (Optical / Laser Extinction)'||chr(10)||
 'ระบบรหัส ISO Scale Code:'||chr(10)||
 '— Code 18 = 1,300–2,500 อนุภาค/mL'||chr(10)||
 '— Code 16 = 320–640 อนุภาค/mL'||chr(10)||
 '— Code 14 = 80–160 อนุภาค/mL'||chr(10)||
 'เป้าหมายความสะอาดตามประเภทระบบ: Servo/Proportional Valve ≤ 16/14/11 | Gear Pump/Motor ≤ 18/16/13 | Plain Bearing ≤ 19/17/14',
 array['Particle Count >4μm(c)','>6μm(c)','>14μm(c)','ISO Cleanliness Code','Particle Counter']
),
(
 'TRIBOLOGY','ASTM D4378-20','Standard Practice for In-Service Monitoring of Mineral Turbine Oils',
 'แนวทางปฏิบัติสำหรับการติดตามสภาพน้ำมันเทอร์ไบน์ไอน้ำและก๊าซในสภาวะการใช้งานจริง ครอบคลุมความถี่ในการเก็บตัวอย่าง วิธีทดสอบที่แนะนำ (TAN, Viscosity, Water, RPVOT, MPC) และค่าขีดจำกัดเตือน',
 'ค่าขีดจำกัดการแจ้งเตือน:'||chr(10)||
 '• Viscosity @40°C: เปลี่ยนแปลง > ±5%'||chr(10)||
 '• Water Content: > 500 ppm (Warning) / > 1,000 ppm (Critical)'||chr(10)||
 '• TAN: เพิ่มขึ้น > 0.3 mgKOH/g'||chr(10)||
 '• RPVOT Retention: < 25% (เปลี่ยนน้ำมัน)'||chr(10)||
 'การทดสอบ: ASTM D445 (Viscosity), D664 (TAN), D6304 (Water), D2272 (RPVOT), D7843 (MPC)',
 array['Viscosity Change ±5%','Water <500 ppm','TAN Increase >0.3','RPVOT Retention >25%','MPC Patch Rating']
),
(
 'VIBRATION','ISO 10816-3:2009','Mechanical vibration — Evaluation of machine vibration (non-rotating parts)',
 'มาตรฐานสำหรับการประเมินความรุนแรงของการสั่นสะเทือนเครื่องจักรอุตสาหกรรม กำลัง >15 kW และความเร็ว 120–15,000 rpm โดยวัดจากชิ้นส่วนไม่หมุน (แบริ่งเฮาส์ซิ่ง) ด้วยค่า Velocity RMS (mm/s) แบ่งโซนการประเมิน A–D',
 'Velocity RMS (mm/s) — เครื่องจักร 15–300 kW:'||chr(10)||
 'โซน A (ใหม่/ปรับแต่งดี): ≤ 2.3'||chr(10)||
 'โซน B (ยอมรับระยะยาว): 2.3–4.5'||chr(10)||
 'โซน C (เฝ้าระวัง): 4.5–7.1'||chr(10)||
 'โซน D (อันตราย หยุดเครื่อง): > 7.1'||chr(10)||
 'ทิศทางวัด: Horizontal (H), Vertical (V), Axial (A) ที่ Drive End และ Non-Drive End — ช่วง 10–1,000 Hz Broadband',
 array['Velocity RMS Zone A–D','Power >15 kW','120–15,000 rpm','Bearing Housing','Rigid/Flexible Foundation']
),
(
 'TRIBOLOGY','AGMA 9005-F16','Industrial Gear Lubrication — Selection and Application',
 'มาตรฐานจาก American Gear Manufacturers Association สำหรับการเลือกและประยุกต์ใช้สารหล่อลื่นเกียร์อุตสาหกรรม ครอบคลุมค่าความหนืด ISO VG ตามโหลด ความเร็ว อุณหภูมิ ประเภทสารเติมแต่ง (R&O, EP, Synthetic PAO/PG) และขีดจำกัดการปนเปื้อน',
 'การเลือก ISO VG ตามอุณหภูมิห้อง:'||chr(10)||
 '• -10°C ถึง 10°C: ISO VG 68–150'||chr(10)||
 '• 10°C ถึง 35°C: ISO VG 150–320'||chr(10)||
 '• 35°C ถึง 55°C: ISO VG 320–680'||chr(10)||
 'ขีดจำกัดน้ำมันเกียร์: Viscosity ±15%/±25% | Water 500/1000 ppm | Fe 150/300 ppm | ISO ≤ 18/16/13'||chr(10)||
 'รอบเปลี่ยน: Mineral R&O 2,000–4,000 ชม. | EP 4,000–8,000 ชม. | Synthetic 8,000–16,000 ชม.',
 array['ISO VG 150–680','EP Additive','Synthetic PAO','Pour Point','Flash Point','Thermal Stability']
),
(
 'RELIABILITY','ISO 17359:2018','Condition Monitoring and Diagnostics of Machines — General Guidelines',
 'มาตรฐานกรอบหลักระดับสากลสำหรับการวางแผนและดำเนินโปรแกรม Condition-Based Maintenance (CBM) ครอบคลุม FMEA การเลือกเทคนิคตรวจวัด การกำหนดความถี่ ระบบแจ้งเตือน และกระบวนการวินิจฉัย',
 'กรอบการดำเนินโปรแกรม CBM (8 ขั้น):'||chr(10)||
 '1. Machine Inventory (Criticality)'||chr(10)||
 '2. Failure Mode Analysis (FMEA/FMECA)'||chr(10)||
 '3. Technology Selection (ตรงกับ Failure Mode)'||chr(10)||
 '4. Alarm Level Setting (Warning/Danger)'||chr(10)||
 '5. Data Collection Plan'||chr(10)||
 '6. Data Analysis (Trend/Spectrum/Oil)'||chr(10)||
 '7. Diagnosis & Prognosis (RUL)'||chr(10)||
 '8. Maintenance Decision'||chr(10)||
 'การจับคู่: Bearing Defect → Vibration+Oil(Fe/Cu) | Misalignment → Vibration 1X/2X | Oil Degradation → Oil(TAN/Visc/RPVOT)',
 array['Failure Mode Analysis','CBM Program','Multi-Technology CM','Alert Levels','Diagnostic Logic']
)
on conflict do nothing;

-- ---------- 5. create the first admin (assign after you sign up once) ----------
-- After registering the first user in the app, promote them to admin:
--   update public.profiles set role = 'admin', site_access = '{}' where email = 'you@example.com';
--   (join via auth.users if needed; or run from Supabase SQL with service role)
