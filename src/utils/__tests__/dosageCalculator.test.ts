import {
  DRUG_DATABASE,
  assessDoseSafety,
  calculateDoseInMg,
  computeDosage,
  convertFromMg,
  convertToMg,
  getDrugsForSpecies,
  lookupDrug,
} from '../dosageCalculator';

// ─── calculateDoseInMg ────────────────────────────────────────────────────────

describe('calculateDoseInMg', () => {
  it('multiplies weight by dose per kg', () => {
    expect(calculateDoseInMg(10, 15)).toBe(150);
  });

  it('handles decimal weights', () => {
    expect(calculateDoseInMg(0.5, 10)).toBe(5);
  });

  it('returns 0 for zero weight', () => {
    expect(calculateDoseInMg(0, 15)).toBe(0);
  });

  it('returns 0 for negative weight', () => {
    expect(calculateDoseInMg(-5, 15)).toBe(0);
  });

  it('returns 0 for zero dose per kg', () => {
    expect(calculateDoseInMg(10, 0)).toBe(0);
  });

  it('returns 0 for negative dose per kg', () => {
    expect(calculateDoseInMg(10, -5)).toBe(0);
  });

  it('handles very small pets — 0.1 kg bird', () => {
    expect(calculateDoseInMg(0.1, 25)).toBeCloseTo(2.5);
  });

  it('handles very large pets — 80 kg mastiff', () => {
    expect(calculateDoseInMg(80, 15)).toBe(1200);
  });

  it('handles micro-dose for 30g canary (0.03 kg)', () => {
    expect(calculateDoseInMg(0.03, 25)).toBeCloseTo(0.75);
  });
});

// ─── convertFromMg ────────────────────────────────────────────────────────────

describe('convertFromMg', () => {
  it('returns mg unchanged', () => {
    expect(convertFromMg(150, 'mg')).toBe(150);
  });

  it('converts mg to ml with concentration', () => {
    expect(convertFromMg(150, 'ml', 10)).toBe(15);
  });

  it('converts mg to tablets with tablet strength', () => {
    expect(convertFromMg(250, 'tablets', undefined, 250)).toBe(1);
  });

  it('calculates fractional tablets', () => {
    expect(convertFromMg(125, 'tablets', undefined, 250)).toBe(0.5);
  });

  it('calculates three-quarter tablet', () => {
    expect(convertFromMg(75, 'tablets', undefined, 100)).toBe(0.75);
  });

  it('throws if ml conversion missing concentration', () => {
    expect(() => convertFromMg(150, 'ml')).toThrow('Concentration');
  });

  it('throws if ml conversion has zero concentration', () => {
    expect(() => convertFromMg(150, 'ml', 0)).toThrow('Concentration');
  });

  it('throws if tablet conversion missing tablet strength', () => {
    expect(() => convertFromMg(150, 'tablets')).toThrow('Tablet strength');
  });

  it('throws if tablet conversion has zero tablet strength', () => {
    expect(() => convertFromMg(150, 'tablets', undefined, 0)).toThrow('Tablet strength');
  });

  it('handles tiny ml dose for 0.1 kg cat on meloxicam (1.5 mg/ml)', () => {
    // 0.1 kg * 0.05 mg/kg = 0.005 mg → 0.005 / 1.5 ≈ 0.00333 ml
    const doseInMg = calculateDoseInMg(0.1, 0.05);
    expect(convertFromMg(doseInMg, 'ml', 1.5)).toBeCloseTo(0.00333, 4);
  });

  it('handles high-concentration liquid (100 mg/ml) for small dose', () => {
    // 5 mg / 100 mg/ml = 0.05 ml
    expect(convertFromMg(5, 'ml', 100)).toBe(0.05);
  });
});

// ─── convertToMg ─────────────────────────────────────────────────────────────

describe('convertToMg', () => {
  it('returns mg unchanged', () => {
    expect(convertToMg(150, 'mg')).toBe(150);
  });

  it('converts ml to mg', () => {
    expect(convertToMg(5, 'ml', 10)).toBe(50);
  });

  it('converts tablets to mg', () => {
    expect(convertToMg(2, 'tablets', undefined, 250)).toBe(500);
  });

  it('converts fractional tablets to mg', () => {
    expect(convertToMg(0.5, 'tablets', undefined, 250)).toBe(125);
  });

  it('throws if ml conversion missing concentration', () => {
    expect(() => convertToMg(5, 'ml')).toThrow('Concentration');
  });

  it('throws if tablet conversion missing tablet strength', () => {
    expect(() => convertToMg(2, 'tablets')).toThrow('Tablet strength');
  });

  it('round-trips mg → ml → mg', () => {
    const original = 37.5;
    const ml = convertFromMg(original, 'ml', 5);
    expect(convertToMg(ml, 'ml', 5)).toBeCloseTo(original);
  });

  it('round-trips mg → tablets → mg', () => {
    const original = 375;
    const tablets = convertFromMg(original, 'tablets', undefined, 250);
    expect(convertToMg(tablets, 'tablets', undefined, 250)).toBeCloseTo(original);
  });
});

// ─── assessDoseSafety ─────────────────────────────────────────────────────────

describe('assessDoseSafety', () => {
  const range = { minPerKg: 10, maxPerKg: 22, typicalPerKg: 15 };

  it('returns safe for typical dose', () => {
    const result = assessDoseSafety(15, range);
    expect(result.level).toBe('safe');
    expect(result.warnings).toHaveLength(0);
  });

  it('returns safe at exact minimum', () => {
    expect(assessDoseSafety(10, range).level).toBe('safe');
  });

  it('returns safe at exact maximum', () => {
    expect(assessDoseSafety(22, range).level).toBe('safe');
  });

  it('returns low for dose below minimum', () => {
    const result = assessDoseSafety(5, range);
    expect(result.level).toBe('low');
    expect(result.warnings[0]).toMatch(/below.*minimum/i);
  });

  it('returns high for dose above maximum', () => {
    const result = assessDoseSafety(25, range);
    expect(result.level).toBe('high');
    expect(result.warnings[0]).toMatch(/exceed/i);
  });

  it('returns critical for dose more than 2x maximum', () => {
    const result = assessDoseSafety(50, range); // > 22 * 2 = 44
    expect(result.level).toBe('critical');
    expect(result.warnings[0]).toMatch(/critically high/i);
  });

  it('returns critical for zero dose', () => {
    expect(assessDoseSafety(0, range).level).toBe('critical');
  });

  it('returns critical for negative dose', () => {
    expect(assessDoseSafety(-1, range).level).toBe('critical');
  });

  it('returns high (not critical) for just-above-max dose', () => {
    expect(assessDoseSafety(23, range).level).toBe('high');
  });

  it('handles tight range — enrofloxacin cat (max = 5 mg/kg)', () => {
    const catRange = { minPerKg: 5, maxPerKg: 5, typicalPerKg: 5 };
    expect(assessDoseSafety(5, catRange).level).toBe('safe');
    expect(assessDoseSafety(6, catRange).level).toBe('high');
    expect(assessDoseSafety(11, catRange).level).toBe('critical'); // > 5 * 2
  });

  it('handles fractional mg/kg range — meloxicam cat (0.05–0.1 mg/kg)', () => {
    const meloxicamCatRange = { minPerKg: 0.05, maxPerKg: 0.1, typicalPerKg: 0.05 };
    expect(assessDoseSafety(0.05, meloxicamCatRange).level).toBe('safe');
    expect(assessDoseSafety(0.07, meloxicamCatRange).level).toBe('safe');
    expect(assessDoseSafety(0.15, meloxicamCatRange).level).toBe('high');
    expect(assessDoseSafety(0.25, meloxicamCatRange).level).toBe('critical'); // > 0.1 * 2
  });
});

// ─── computeDosage ────────────────────────────────────────────────────────────

describe('computeDosage', () => {
  const amoxRange = { minPerKg: 10, maxPerKg: 22, typicalPerKg: 15 };

  it('computes basic mg dose', () => {
    const result = computeDosage({ weightKg: 10, dosePerKg: 15, targetUnit: 'mg' });
    expect(result.dose).toBe(150);
    expect(result.doseInMg).toBe(150);
    expect(result.unit).toBe('mg');
    expect(result.safetyLevel).toBe('safe');
  });

  it('computes ml dose with concentration', () => {
    // 10 kg * 0.1 mg/kg = 1 mg; 1 / 1.5 ≈ 0.667 ml
    const result = computeDosage({
      weightKg: 10,
      dosePerKg: 0.1,
      targetUnit: 'ml',
      concentration: 1.5,
    });
    expect(result.dose).toBeCloseTo(0.667, 2);
    expect(result.unit).toBe('ml');
  });

  it('computes tablet count from tablet strength', () => {
    // 10 kg * 25 mg/kg = 250 mg; 250 / 250 = 1 tablet
    const result = computeDosage({
      weightKg: 10,
      dosePerKg: 25,
      targetUnit: 'tablets',
      tabletStrength: 250,
    });
    expect(result.dose).toBe(1);
  });

  it('includes safe range in result when range provided', () => {
    const result = computeDosage({ weightKg: 10, dosePerKg: 15, targetUnit: 'mg' }, amoxRange);
    expect(result.rangeMin).toBe(100); // 10 * 10
    expect(result.rangeMax).toBe(220); // 10 * 22
  });

  it('flags high dose with safety warning', () => {
    const result = computeDosage({ weightKg: 10, dosePerKg: 30, targetUnit: 'mg' }, amoxRange);
    expect(result.safetyLevel).toBe('high');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('flags critically high dose', () => {
    const result = computeDosage({ weightKg: 10, dosePerKg: 50, targetUnit: 'mg' }, amoxRange);
    expect(result.safetyLevel).toBe('critical');
  });

  it('flags sub-therapeutic dose', () => {
    const result = computeDosage({ weightKg: 10, dosePerKg: 5, targetUnit: 'mg' }, amoxRange);
    expect(result.safetyLevel).toBe('low');
  });

  it('returns critical and zero dose for zero weight', () => {
    const result = computeDosage({ weightKg: 0, dosePerKg: 15, targetUnit: 'mg' });
    expect(result.safetyLevel).toBe('critical');
    expect(result.dose).toBe(0);
    expect(result.warnings[0]).toMatch(/weight/i);
  });

  it('returns critical for negative weight', () => {
    const result = computeDosage({ weightKg: -5, dosePerKg: 15, targetUnit: 'mg' });
    expect(result.safetyLevel).toBe('critical');
  });

  it('returns critical for zero dose per kg', () => {
    const result = computeDosage({ weightKg: 10, dosePerKg: 0, targetUnit: 'mg' });
    expect(result.safetyLevel).toBe('critical');
  });

  it('returns critical when ml selected but no concentration provided', () => {
    const result = computeDosage({ weightKg: 10, dosePerKg: 0.1, targetUnit: 'ml' });
    expect(result.safetyLevel).toBe('critical');
    expect(result.warnings[0]).toMatch(/Concentration/i);
  });

  it('returns critical when tablets selected but no tablet strength provided', () => {
    const result = computeDosage({ weightKg: 10, dosePerKg: 15, targetUnit: 'tablets' });
    expect(result.safetyLevel).toBe('critical');
    expect(result.warnings[0]).toMatch(/Tablet strength/i);
  });

  // ─── Edge cases: very small pets ─────────────────────────────────────────

  it('computes dose for tiny pet — 50g mouse (0.05 kg)', () => {
    const result = computeDosage({ weightKg: 0.05, dosePerKg: 20, targetUnit: 'mg' });
    expect(result.dose).toBe(1); // 0.05 * 20 = 1 mg
    expect(result.doseInMg).toBe(1);
  });

  it('computes dose for 10g hatchling (0.01 kg)', () => {
    const result = computeDosage({ weightKg: 0.01, dosePerKg: 10, targetUnit: 'mg' });
    expect(result.dose).toBe(0.1);
  });

  it('computes micro-ml dose for 30g canary on doxycycline suspension', () => {
    // 0.03 kg * 25 mg/kg = 0.75 mg; 0.75 / 50 mg/ml = 0.015 ml
    const result = computeDosage({
      weightKg: 0.03,
      dosePerKg: 25,
      targetUnit: 'ml',
      concentration: 50,
    });
    expect(result.dose).toBeCloseTo(0.015, 4);
  });

  // ─── Edge cases: very large pets ─────────────────────────────────────────

  it('computes dose for large breed dog — 70 kg', () => {
    const result = computeDosage({ weightKg: 70, dosePerKg: 15, targetUnit: 'mg' }, amoxRange);
    expect(result.dose).toBe(1050);
    expect(result.safetyLevel).toBe('safe');
  });

  it('computes dose for giant breed — 100 kg Great Dane', () => {
    const result = computeDosage({ weightKg: 100, dosePerKg: 22, targetUnit: 'mg' }, amoxRange);
    expect(result.dose).toBe(2200);
    expect(result.safetyLevel).toBe('safe');
  });

  it('flags critically high dose for large pet', () => {
    const result = computeDosage({ weightKg: 70, dosePerKg: 50, targetUnit: 'mg' }, amoxRange);
    expect(result.safetyLevel).toBe('critical');
    expect(result.doseInMg).toBe(3500);
  });

  // ─── Edge cases: unusual medications ─────────────────────────────────────

  it('handles custom high-concentration liquid (100 mg/ml)', () => {
    // 0.5 kg * 10 mg/kg = 5 mg; 5 / 100 = 0.05 ml
    const result = computeDosage({
      weightKg: 0.5,
      dosePerKg: 10,
      targetUnit: 'ml',
      concentration: 100,
    });
    expect(result.dose).toBe(0.05);
    expect(result.doseInMg).toBe(5);
  });

  it('handles very low concentration liquid (0.1 mg/ml)', () => {
    // 5 kg * 0.1 mg/kg = 0.5 mg; 0.5 / 0.1 = 5 ml
    const result = computeDosage({
      weightKg: 5,
      dosePerKg: 0.1,
      targetUnit: 'ml',
      concentration: 0.1,
    });
    expect(result.dose).toBe(5);
  });

  it('handles chemotherapy-range dose (50–100 mg/kg)', () => {
    const chemoRange = { minPerKg: 50, maxPerKg: 100, typicalPerKg: 75 };
    const result = computeDosage({ weightKg: 5, dosePerKg: 75, targetUnit: 'mg' }, chemoRange);
    expect(result.dose).toBe(375);
    expect(result.safetyLevel).toBe('safe');
    expect(result.rangeMin).toBe(250);
    expect(result.rangeMax).toBe(500);
  });

  it('handles sub-mg doses for potent medications', () => {
    // 0.001 mg/kg for a 10 kg dog = 0.01 mg total
    const result = computeDosage({ weightKg: 10, dosePerKg: 0.001, targetUnit: 'mg' });
    expect(result.dose).toBe(0.01);
  });
});

// ─── lookupDrug ───────────────────────────────────────────────────────────────

describe('lookupDrug', () => {
  it('returns drug info for known drug and species', () => {
    const result = lookupDrug('amoxicillin', 'dog');
    expect(result).not.toBeNull();
    expect(result!.drug.name).toBe('Amoxicillin');
    expect(result!.range).not.toBeNull();
    expect(result!.range!.typicalPerKg).toBe(15);
  });

  it('returns null for unknown drug', () => {
    expect(lookupDrug('unknowndrug_xyz', 'dog')).toBeNull();
  });

  it('returns null range for species not in drug profile', () => {
    // carprofen has no cat dosage defined
    const result = lookupDrug('carprofen', 'cat');
    expect(result).not.toBeNull();
    expect(result!.range).toBeNull();
  });

  it('returns contraindication for rabbit amoxicillin', () => {
    const result = lookupDrug('amoxicillin', 'rabbit');
    expect(result).not.toBeNull();
    expect(result!.contraindications.length).toBeGreaterThan(0);
    expect(result!.contraindications[0]).toMatch(/enterotoxemia/i);
  });

  it('returns strict 5 mg/kg max for enrofloxacin in cats', () => {
    const result = lookupDrug('enrofloxacin', 'cat');
    expect(result).not.toBeNull();
    expect(result!.range!.maxPerKg).toBe(5);
    expect(result!.warnings[0]).toMatch(/blind/i);
  });

  it('returns higher bird-specific range for doxycycline', () => {
    // birds need ~5x more doxycycline than dogs/cats
    const result = lookupDrug('doxycycline', 'bird');
    expect(result).not.toBeNull();
    expect(result!.range!.typicalPerKg).toBe(25);
    expect(result!.range!.typicalPerKg).toBeGreaterThan(
      lookupDrug('doxycycline', 'dog')!.range!.typicalPerKg,
    );
  });

  it('returns rabbit-specific metronidazole range (higher than dog/cat)', () => {
    const rabbit = lookupDrug('metronidazole', 'rabbit');
    const dog = lookupDrug('metronidazole', 'dog');
    expect(rabbit!.range!.typicalPerKg).toBeGreaterThan(dog!.range!.typicalPerKg);
  });

  it('returns meloxicam warnings for cats', () => {
    const result = lookupDrug('meloxicam', 'cat');
    expect(result!.warnings.length).toBeGreaterThan(0);
    expect(result!.contraindications.length).toBeGreaterThan(0);
  });
});

// ─── getDrugsForSpecies ───────────────────────────────────────────────────────

describe('getDrugsForSpecies', () => {
  it('returns drugs available for dogs', () => {
    const drugs = getDrugsForSpecies('dog');
    expect(drugs.length).toBeGreaterThan(0);
    expect(drugs.every((d) => d.dosageBySpecies.dog !== undefined)).toBe(true);
  });

  it('returns drugs available for cats', () => {
    const drugs = getDrugsForSpecies('cat');
    expect(drugs.length).toBeGreaterThan(0);
    expect(drugs.every((d) => d.dosageBySpecies.cat !== undefined)).toBe(true);
  });

  it('returns drugs available for birds', () => {
    const drugs = getDrugsForSpecies('bird');
    expect(drugs.length).toBeGreaterThan(0);
    expect(drugs.every((d) => d.dosageBySpecies.bird !== undefined)).toBe(true);
  });

  it('returns drugs available for rabbits', () => {
    const drugs = getDrugsForSpecies('rabbit');
    expect(drugs.length).toBeGreaterThan(0);
  });

  it('returns an array for other species (may be empty)', () => {
    const drugs = getDrugsForSpecies('other');
    expect(Array.isArray(drugs)).toBe(true);
  });

  it('does not include carprofen for cats', () => {
    const drugs = getDrugsForSpecies('cat');
    expect(drugs.find((d) => d.id === 'carprofen')).toBeUndefined();
  });

  it('does not include amoxicillin for rabbits (contraindicated)', () => {
    // amoxicillin has no rabbit entry in dosageBySpecies
    const drugs = getDrugsForSpecies('rabbit');
    expect(drugs.find((d) => d.id === 'amoxicillin')).toBeUndefined();
  });
});

// ─── DRUG_DATABASE integrity ─────────────────────────────────────────────────

describe('DRUG_DATABASE integrity', () => {
  it('every drug has required fields', () => {
    DRUG_DATABASE.forEach((drug) => {
      expect(drug.id).toBeTruthy();
      expect(drug.name).toBeTruthy();
      expect(drug.drugClass).toBeTruthy();
      expect(typeof drug.dosageBySpecies).toBe('object');
      expect(typeof drug.safetyWarnings).toBe('object');
      expect(typeof drug.contraindications).toBe('object');
    });
  });

  it('all non-zero dosage ranges satisfy min <= typical <= max', () => {
    DRUG_DATABASE.forEach((drug) => {
      Object.entries(drug.dosageBySpecies).forEach(([, range]) => {
        if (range && range.maxPerKg > 0) {
          expect(range.minPerKg).toBeLessThanOrEqual(range.typicalPerKg);
          expect(range.typicalPerKg).toBeLessThanOrEqual(range.maxPerKg);
        }
      });
    });
  });

  it('drugs with concentration have positive concentration', () => {
    DRUG_DATABASE.filter((d) => d.concentration !== undefined).forEach((d) => {
      expect(d.concentration).toBeGreaterThan(0);
    });
  });

  it('drugs with tabletStrength have positive tabletStrength', () => {
    DRUG_DATABASE.filter((d) => d.tabletStrength !== undefined).forEach((d) => {
      expect(d.tabletStrength).toBeGreaterThan(0);
    });
  });

  it('drug IDs are unique', () => {
    const ids = DRUG_DATABASE.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── calculateDoseInMg: NaN and numeric overflow ─────────────────────────────

describe('calculateDoseInMg NaN/overflow', () => {
  it('propagates NaN for NaN weight', () => {
    expect(calculateDoseInMg(NaN, 15)).toBeNaN();
  });

  it('propagates NaN for NaN dose per kg', () => {
    expect(calculateDoseInMg(10, NaN)).toBeNaN();
  });

  it('overflows to Infinity for astronomically large inputs', () => {
    // 1e308 * 10 exceeds Number.MAX_VALUE → Infinity
    expect(calculateDoseInMg(1e308, 10)).toBe(Infinity);
  });

  it('returns Infinity for infinite weight with finite dose', () => {
    expect(calculateDoseInMg(Infinity, 0.1)).toBe(Infinity);
  });
});

// ─── conversions: negative amounts and rejected negative parameters ──────────

describe('conversion negative parameter handling', () => {
  it('passes negative amounts through for mg', () => {
    expect(convertFromMg(-150, 'mg')).toBe(-150);
  });

  it('produces fractional tablets for negative mg', () => {
    expect(convertFromMg(-125, 'tablets', undefined, 250)).toBe(-0.5);
  });

  it('converts negative tablet amounts back to negative mg', () => {
    expect(convertToMg(-5, 'tablets', undefined, 250)).toBe(-1250);
  });

  it('rejects negative concentration in convertFromMg', () => {
    expect(() => convertFromMg(150, 'ml', -10)).toThrow('Concentration');
  });

  it('rejects negative concentration in convertToMg', () => {
    expect(() => convertToMg(5, 'ml', -10)).toThrow('Concentration');
  });

  it('rejects negative tablet strength in convertFromMg', () => {
    expect(() => convertFromMg(150, 'tablets', undefined, -250)).toThrow('Tablet strength');
  });

  it('converts Infinity mg to Infinity tablets', () => {
    expect(convertFromMg(Infinity, 'tablets', undefined, 250)).toBe(Infinity);
  });

  it('passes NaN amount through for mg', () => {
    expect(convertFromMg(NaN, 'mg')).toBeNaN();
  });
});

// ─── rounding: 3-decimal precision behaviour ─────────────────────────────────

describe('computeDosage rounding behaviour', () => {
  it('rounds repeating decimals up to 3 decimal places', () => {
    // 0.1 kg * 0.333 mg/kg = 0.0333 mg → rounded to 0.033
    const result = computeDosage({ weightKg: 0.1, dosePerKg: 0.333, targetUnit: 'mg' });
    expect(result.doseInMg).toBe(0.033);
    expect(result.dose).toBe(0.033);
  });

  it('rounds a 4th-decimal 6 up (0.0116 → 0.012)', () => {
    // 2 kg * 0.0058 mg/kg = 0.0116 mg → rounds to 0.012
    const result = computeDosage({ weightKg: 2, dosePerKg: 0.0058, targetUnit: 'mg' });
    expect(result.doseInMg).toBe(0.012);
  });

  it('rounds sub-0.0005 mg doses all the way down to zero', () => {
    // 5 kg * 1e-7 mg/kg = 0.0000005 mg → 3-decimal rounding yields 0
    const result = computeDosage({ weightKg: 5, dosePerKg: 1e-7, targetUnit: 'mg' });
    expect(result.dose).toBe(0);
    expect(result.doseInMg).toBe(0);
  });

  it('rounds ml range bounds to 3 decimals', () => {
    // dog meloxicam range 0.1–0.2 mg/kg at 1.5 mg/ml, 10 kg:
    // min 1 mg → 0.6667 ml → 0.667 ; max 2 mg → 1.3333 ml → 1.333
    const result = computeDosage(
      { weightKg: 10, dosePerKg: 0.1, targetUnit: 'ml', concentration: 1.5 },
      { minPerKg: 0.1, maxPerKg: 0.2, typicalPerKg: 0.1 },
    );
    expect(result.rangeMin).toBe(0.667);
    expect(result.rangeMax).toBe(1.333);
  });
});

// ─── assessDoseSafety: exact 2x boundary and warning copy ────────────────────

describe('assessDoseSafety exact 2x-max boundary', () => {
  const range = { minPerKg: 10, maxPerKg: 22, typicalPerKg: 15 };

  it('treats a dose of exactly 2x max as high, not critical', () => {
    expect(assessDoseSafety(44, range).level).toBe('high'); // 22 * 2 = 44, not > 44
  });

  it('treats anything above 2x max as critical', () => {
    expect(assessDoseSafety(45, range).level).toBe('critical');
  });

  it('emits exact high-dose warning copy at the boundary', () => {
    expect(assessDoseSafety(23, range).warnings).toEqual([
      'Dose of 23.00 mg/kg exceeds the maximum safe dose of 22 mg/kg.',
    ]);
  });

  it('emits exact critical warning copy with formatted threshold', () => {
    expect(assessDoseSafety(45, range).warnings).toEqual([
      'Dose of 45.00 mg/kg is critically high (>44.00 mg/kg). Severe toxicity risk.',
    ]);
  });

  it('emits exact low-dose warning copy', () => {
    expect(assessDoseSafety(9, range).warnings).toEqual([
      'Dose of 9.00 mg/kg is below the minimum effective dose of 10 mg/kg. Treatment may be sub-therapeutic.',
    ]);
  });
});

// ─── computeDosage: infinite inputs and zero-sign edge ───────────────────────

describe('computeDosage infinite-input pipeline', () => {
  const range = { minPerKg: 10, maxPerKg: 22, typicalPerKg: 15 };

  it('produces an Infinity dose for infinite weight while safety stays per-kg', () => {
    const result = computeDosage({ weightKg: Infinity, dosePerKg: 15, targetUnit: 'mg' }, range);
    expect(result.dose).toBe(Infinity);
    expect(result.doseInMg).toBe(Infinity);
    // safety assessment is per-kg, so 15 mg/kg remains "safe" regardless of weight
    expect(result.safetyLevel).toBe('safe');
  });

  it('flags critical for infinite dose per kg', () => {
    const result = computeDosage({ weightKg: 70, dosePerKg: Infinity, targetUnit: 'mg' }, range);
    expect(result.safetyLevel).toBe('critical');
    expect(result.doseInMg).toBe(Infinity);
    expect(result.warnings[0]).toMatch(/critically high/i);
  });

  it('treats negative zero weight as invalid', () => {
    const result = computeDosage({ weightKg: -0, dosePerKg: 15, targetUnit: 'mg' });
    expect(result.safetyLevel).toBe('critical');
    expect(result.dose).toBe(0);
    expect(result.warnings[0]).toBe('Weight must be greater than zero.');
  });
});

// ─── lookupDrug: species without dosage data ─────────────────────────────────

describe('lookupDrug species without dosage data', () => {
  it('returns null range and empty lists for fish on amoxicillin', () => {
    const result = lookupDrug('amoxicillin', 'fish');
    expect(result).not.toBeNull();
    expect(result!.range).toBeNull();
    expect(result!.warnings).toEqual([]);
    expect(result!.contraindications).toEqual([]);
  });

  it('returns null for a valid drug with an unknown species profile', () => {
    const result = lookupDrug('enrofloxacin', 'hamster');
    expect(result).not.toBeNull();
    expect(result!.range).toBeNull();
  });
});
