// labPatterns.js - This file includes regex patterns to extract lab values from text

// function createLabPattern(name, alternateNames, unit, displayUnit) {
//     const namePattern = [name, ...alternateNames]
//         .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
//         .join('|');
    
//     return {
//         regex: new RegExp(
//             `(?:${namePattern})` +               // Main name or alternates
//             '\\s*:?\\s*' +                       // Optional colon with flexible spacing
//             '(?:[LEH]\\s*)?'+                    // Optional flags (Low/Elevated/High)
//             '(\\d{1,6}\\.?\\d*)\\s*' +           // The value (capture group 1) - limit to 6 digits
//             '(?:' +                              // Non-capturing group for units/ranges
//                 '(?:\\d+\\.?\\d*\\s*[-–]\\s*\\d+\\.?\\d*)?\\s*' + // Optional reference range
//                 unit +                           // Unit
//             ')?',                                // Make the whole unit/range part optional
//             'i'                                  // Case insensitive
//         ),
//         standardUnit: displayUnit || unit,
//         alternateNames: alternateNames,
//         fuzzyThreshold: 0.85                    // Levenshtein distance threshold
//     };
// }
function createLabPattern(name, alternateNames, unit, displayUnit) {
    const namePattern = [name, ...alternateNames]
        .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');
    
    return {
        regex: new RegExp(
            `(?:${namePattern})` +               // Main name or alternates
            '\\s*:?\\s*' +                       // Optional colon with flexible spacing
            '(?:[LEH]\\s*)?'+                    // Optional flags (Low/Elevated/High)
            '(\\d{1,6}\\.?\\d*)\\s*' +           // The value (capture group 1) - limit to 6 digits
            '(?:' +                              // Start non-capturing group
                '(?:(?:\\s+|)' +                 // Optional spacing
                '(\\d+\\.?\\d*\\s*[-–]\\s*\\d+\\.?\\d*))?' + // Optional reference range (new capture group 2)
                '\\s*' +                         // Optional spacing
                unit +                           // Unit
            ')?',                                // Make the whole unit/range part optional
            'i'                                  // Case insensitive
        ),
        standardUnit: displayUnit || unit,
        alternateNames: alternateNames,
        fuzzyThreshold: 0.85                    // Levenshtein distance threshold
    };
}

// Create pattern for structured format (TEST NAME: ___ RESULT: ___ format)
function createStructuredLabPattern(name, alternateNames, unit, displayUnit) {
    const namePattern = [name, ...alternateNames]
        .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');
    
    return {
        regex: new RegExp(
            `(?:${namePattern})\\s*(?:RESULT)?\\s*(?::|\\s)\\s*(\\d+\\.?\\d*)\\s*(?:${unit})`,
            'i'
        ),
        standardUnit: displayUnit || unit,
        alternateNames: alternateNames,
        fuzzyThreshold: 0.85
    };
}

const labPatterns = {
    // Blood Count (CBC)
    'WBC': createLabPattern(
        'WBC',
        ['White Blood Cells', 'White Blood Count', 'Leukocytes'],
        '(?:x10\\^9\\/L|×10[⁹9]?\\/L|x10\\(9\\)\\/L|K\\/[μµ]L)',
        '×10⁹/L'
    ),
    'RBC': createLabPattern(
        'RBC',
        ['Red Blood Cells', 'Red Blood Count', 'Erythrocytes'],
        '(?:x10\\^12\\/L|×10[¹²12]?\\/L|x10\\(12\\)\\/L|M\\/[μµ]L)',
        '×10¹²/L'
    ),
    'Hgb': createLabPattern('Hgb',
        ['Hemoglobin', 'HGB', 'Hb'],
        'g\\/L',
        'g/L'
    ),
    'Hct': createLabPattern('Hct',
        ['Hematocrit', 'HCT'],
        '%',
        '%'
    ),
    'MCV': createLabPattern('MCV',
        ['Mean Corpuscular Volume'],
        'fL',
        'fL'
    ),
    'MCH': createLabPattern('MCH',
        ['Mean Corpuscular Hemoglobin'],
        'pg',
        'pg'
    ),
    'MCHC': createLabPattern('MCHC',
        ['Mean Corpuscular Hemoglobin Concentration'],
        'g\\/L',
        'g/L'
    ),
    'RDW': createLabPattern('RDW',
        ['Red Cell Distribution Width'],
        '%',
        '%'
    ),
    'PLT': createLabPattern('PLT',
        ['Platelets', 'Platelet Count'],
        '(?:x10\\^9\\/L|×10[⁹9]?\\/L|x10\\(9\\)\\/L)',
        '×10⁹/L'
    ),
    'MPV': createLabPattern('MPV',
        ['Mean Platelet Volume'],
        'fL',
        'fL'
    ),

    // Differential
    'Neutrophils': createLabPattern('Neut',
        ['Neutrophils', 'Neutrophil Count'],
        '(?:%|x10\\^9\\/L|×10[⁹9]?\\/L)',
        'x10⁹/L'
    ),
    'Lymphocytes': createLabPattern('Lymph',
        ['Lymphocytes', 'Lymphocyte Count'],
        '(?:%|x10\\^9\\/L|×10[⁹9]?\\/L)',
        'x10⁹/L'
    ),
    'Monocytes': createLabPattern('Mono',
        ['Monocytes', 'Monocyte Count'],
        '(?:%|x10\\^9\\/L|×10[⁹9]?\\/L)',
        'x10⁹/L'
    ),
    'Eosinophils': createLabPattern('Eos',
        ['Eosinophils', 'Eosinophil Count'],
        '(?:%|x10\\^9\\/L|×10[⁹9]?\\/L)',
        'x10⁹/L'
    ),
    'Basophils': createLabPattern('Baso',
        ['Basophils', 'Basophil Count'],
        '(?:%|x10\\^9\\/L|×10[⁹9]?\\/L)',
        'x10⁹/L'
    ),

    // Chemistry
    'Glucose Random': createLabPattern('Glucose Random',
        ['Glucose', 'Blood Glucose', 'Random Glucose'],
        'mmol\\/L',
        'mmol/L'
    ),
    'Creatinine': createLabPattern('Creatinine',
        ['Creat', 'Serum Creatinine'],
        '(?:umol\\/L|µmol\\/L)',
        'µmol/L'
    ),
    'eGFR': createLabPattern('eGFR',
        ['Estimated GFR', 'Glomerular Filtration Rate'],
        'mL\\/min\\/1\\.73m[²2]',
        'mL/min/1.73m²'
    ),
    'ALT': createLabPattern('ALT',
        ['Alanine Aminotransferase', 'SGPT'],
        'U\\/L',
        'U/L'
    ),
    'Albumin': createLabPattern('Albumin',
        ['Alb', 'Serum Albumin'],
        'g\\/L',
        'g/L'
    ),

    // Electrolytes
    'Sodium': createLabPattern('Sodium',
        ['Na', 'Na+'],
        'mmol\\/L',
        'mmol/L'
    ),
    'Potassium': createLabPattern('Potassium',
        ['K', 'K+'],
        'mmol\\/L',
        'mmol/L'
    ),
    'Calcium': createLabPattern('Calcium',
        ['Ca', 'Ca2+', 'Total Calcium'],
        'mmol\\/L',
        'mmol/L'
    ),
    'Corrected Calcium': createLabPattern('Corrected Total Calcium',
        ['Corrected Ca', 'Adjusted Calcium'],
        'mmol\\/L',
        'mmol/L'
    ),
    'Phosphorus': createLabPattern('Phosphorus',
        ['Phosphate', 'PO4'],
        'mmol\\/L',
        'mmol/L'
    ),

    // Other Tests
    'C-Reactive Protein': createLabPattern('C-Reactive Protein',
        ['CRP', 'C Reactive Protein'],
        'mg\\/L',
        'mg/L'
    ),
    'Uric Acid': createLabPattern('Uric Acid',
        ['Urate'],
        'umol\\/L',
        'µmol/L'
    ),
    'Hemoglobin A1c': createLabPattern('(?:Hgb A1c|Hemoglobin A1C)',
        ['HbA1c', 'Glycated Hemoglobin'],
        '%',
        '%'
    ),

    // Hormones
    'TSH': createLabPattern('(?:TSH|Thyroid Stimulating Hormone)',
        ['Thyrotropin'],
        'mIU\\/L',
        'mIU/L'
    ),
    'T4 Free': createLabPattern('T4 Free',
        ['Free T4', 'FT4'],
        'pmol\\/L',
        'pmol/L'
    ),
    'Testosterone': createLabPattern('Testosterone',
        ['Total Testosterone'],
        'nmol\\/L',
        'nmol/L'
    ),
    'C-Peptide': createLabPattern('C-Peptide',
        ['C Peptide'],
        'pmol\\/L',
        'pmol/L'
    ),
    
    // Additional Cardiovascular Markers
    'HDL-C': createLabPattern('HDL-C',
        ['HDL', 'High Density Lipoprotein', 'High-Density Lipoprotein', 'HDL Cholesterol'],
        '(?:mmol\\/L|mg\\/dL)',
        'mmol/L'
    ),
    'LDL-C': createLabPattern('LDL-C',
        ['LDL', 'Low Density Lipoprotein', 'Low-Density Lipoprotein', 'LDL Cholesterol'],
        '(?:mmol\\/L|mg\\/dL)',
        'mmol/L'
    ),
    'Triglycerides': createLabPattern('Triglycerides',
        ['TG', 'Trigs'],
        '(?:mmol\\/L|mg\\/dL)',
        'mmol/L'
    ),
    'Total Cholesterol': createLabPattern('Total Cholesterol',
        ['TC', 'Cholesterol'],
        '(?:mmol\\/L|mg\\/dL)',
        'mmol/L'
    ),
    'VLDL-C': createLabPattern('VLDL-C',
        ['VLDL', 'Very Low Density Lipoprotein', 'Very-Low-Density Lipoprotein'],
        '(?:mmol\\/L|mg\\/dL)',
        'mmol/L'
    ),
    'Non-HDL-C': createLabPattern('Non-HDL-C',
        ['Non HDL', 'Non HDL Cholesterol'],
        '(?:mmol\\/L|mg\\/dL)',
        'mmol/L'
    ),
    'TC/HDL-C': createLabPattern('TC/HDL-C',
        ['TC/HDL', 'Total Cholesterol/HDL', 'Cholesterol/HDL Ratio'],
        '',
        'ratio'
    ),
    'ApoA1': createLabPattern('ApoA1',
        ['Apolipoprotein A1', 'Apo A1', 'Apo A-1'],
        '(?:g\\/L|mg\\/dL)',
        'g/L'
    ),
    'Apo-B': createLabPattern('(?:Apo-B|Apolipoprotein B|APOLIPOPROTEIN B)',
        ['Apo B', 'ApoB', 'APOLIPOPROTEIN B', 'Apolipoprotein B'],
        '(?:g\\/L|mg\\/dL)',
        'g/L'
    ),
    'Lp(a)': createLabPattern('Lp\\(a\\)',
        ['Lipoprotein a', 'Lipoprotein little a'],
        '(?:nmol\\/L|mg\\/dL)',
        'nmol/L'
    ),
    'LDL Particle Number': createLabPattern('LDL Particle Number',
        ['LDL-P', 'LDL Particles', 'LDL-P Total'],
        '(?:nmol\\/L|mg\\/dL)',
        'nmol/L'
    ),
    'LDL Particle Size': createLabPattern('LDL Particle Size',
        ['LDL Size', 'LDL-S'],
        '(?:nm)',
        'nm'
    ),
    'HDL Particle Number': createLabPattern('HDL Particle Number',
        ['HDL-P', 'HDL Particles', 'HDL-P Total'],
        '(?:μmol\\/L|mg\\/dL)',
        'μmol/L'
    ),
    'oxLDL': createLabPattern('oxLDL',
        ['Oxidized LDL', 'Oxidised LDL'],
        '(?:U\\/L|mg\\/dL)',
        'U/L'
    ),
    'PCSK9': createLabPattern('PCSK9',
        ['Proprotein Convertase Subtilisin/Kexin Type 9'],
        '(?:ng\\/mL)',
        'ng/mL'
    ),
    
    // Additional Metabolic Markers
    'Fasting Blood Glucose': createLabPattern('Fasting Blood Glucose',
        ['FBG', 'Fasting Glucose', 'Glucose Fasting'],
        '(?:mmol\\/L|mg\\/dL)',
        'mmol/L'
    ),
    'Fasting Insulin': createLabPattern('Fasting Insulin',
        ['Insulin, Fasting', 'Insulin Level'],
        '(?:pmol\\/L|μIU\\/mL|uIU\\/mL)',
        'pmol/L'
    ),
    'HOMA-IR': createLabPattern('HOMA-IR',
        ['Homeostatic Model Assessment', 'HOMA Index', 'HOMA'],
        '',
        ''
    ),
    'Adiponectin': createLabPattern('Adiponectin',
        ['ADPN'],
        '(?:μg\\/mL|mg\\/L)',
        'μg/mL'
    ),
    'Leptin': createLabPattern('Leptin',
        [],
        '(?:ng\\/mL)',
        'ng/mL'
    ),
    'GGT/AST Ratio': createLabPattern('GGT/AST Ratio',
        ['GGT:AST', 'GGT/AST'],
        '',
        'ratio'
    ),
    
    // Additional Liver Markers
    'AST': createLabPattern('AST',
        ['Aspartate Aminotransferase', 'SGOT'],
        'U\\/L',
        'U/L'
    ),
    'GGT': createLabPattern('GGT',
        ['Gamma-Glutamyl Transferase', 'Gamma-Glutamyl Transpeptidase', 'GGTP'],
        'U\\/L',
        'U/L'
    ),
    'ALP': createLabPattern('ALP',
        ['Alkaline Phosphatase'],
        'U\\/L',
        'U/L'
    ),
    'Bilirubin': createLabPattern('Bilirubin',
        ['Total Bilirubin', 'T. Bilirubin'],
        '(?:μmol\\/L|mg\\/dL)',
        'μmol/L'
    ),
    'Direct Bilirubin': createLabPattern('Direct Bilirubin',
        ['Conjugated Bilirubin', 'DB'],
        '(?:μmol\\/L|mg\\/dL)',
        'μmol/L'
    ),
    'Indirect Bilirubin': createLabPattern('Indirect Bilirubin',
        ['Unconjugated Bilirubin', 'IB'],
        '(?:μmol\\/L|mg\\/dL)',
        'μmol/L'
    ),
    'Albumin/Globulin Ratio': createLabPattern('Albumin/Globulin Ratio',
        ['A/G Ratio', 'Albumin:Globulin Ratio'],
        '',
        'ratio'
    ),
    'Total Protein': createLabPattern('Total Protein',
        ['TP'],
        '(?:g\\/L|g\\/dL)',
        'g/L'
    ),
    'Creatine Kinase': createLabPattern('Creatine Kinase',
        ['CK', 'CPK'],
        'U\\/L',
        'U/L'
    ),
    
    // Additional Kidney Markers
    'BUN': createLabPattern('BUN',
        ['Blood Urea Nitrogen', 'Urea Nitrogen'],
        '(?:mmol\\/L|mg\\/dL)',
        'mmol/L'
    ),
    'BUN/Creatinine Ratio': createLabPattern('BUN/Creatinine Ratio',
        ['BUN:Creatinine', 'Urea:Creatinine Ratio'],
        '',
        'ratio'
    ),
    'Cystatin C': createLabPattern('Cystatin C',
        ['Cys C'],
        '(?:mg\\/L)',
        'mg/L'
    ),
    'Microalbumin': createLabPattern('Microalbumin',
        ['Urine Albumin', 'Urinary Albumin'],
        '(?:mg\\/L|mg\\/24h)',
        'mg/L'
    ),
    'Uric Acid': createLabPattern('Uric Acid',
        ['UA', 'Urate'],
        '(?:μmol\\/L|mg\\/dL)',
        'μmol/L'
    ),
    'Urine pH': createLabPattern('Urine pH',
        ['U pH', 'pH, Urine'],
        '',
        ''
    ),
    
    // Additional Pancreas Markers
    'Amylase': createLabPattern('Amylase',
        ['AMY'],
        'U\\/L',
        'U/L'
    ),
    'Lipase': createLabPattern('Lipase',
        ['LPS'],
        'U\\/L',
        'U/L'
    ),
    
    // Additional Hormone Markers
    'Free Testosterone': createLabPattern('Free Testosterone',
        ['Free T', 'FT'],
        '(?:pmol\\/L|ng\\/dL)',
        'pmol/L'
    ),
    'SHBG': createLabPattern('SHBG',
        ['Sex Hormone Binding Globulin', 'Sex Hormone-Binding Globulin', 'Binding Globulin'],
        '(?:nmol\\/L)',
        'nmol/L'
    ),
    'DHEA-S': createLabPattern('DHEA-S',
        ['Dehydroepiandrosterone Sulfate', 'DHEAS'],
        '(?:μmol\\/L|μg\\/dL)',
        'μmol/L'
    ),
    'Free T3': createLabPattern('Free T3',
        ['FT3', 'T3, Free'],
        '(?:pmol\\/L|pg\\/mL)',
        'pmol/L'
    ),
    'Reverse T3': createLabPattern('Reverse T3',
        ['rT3', 'T3, Reverse'],
        '(?:pmol\\/L|ng\\/dL)',
        'pmol/L'
    ),
    'Estradiol': createLabPattern('Estradiol',
        ['E2', '17β-Estradiol'],
        '(?:pmol\\/L|pg\\/mL)',
        'pmol/L'
    ),
    'Prolactin': createLabPattern('Prolactin',
        ['PRL'],
        '(?:mIU\\/L|ng\\/mL)',
        'mIU/L'
    ),
    'FSH': createLabPattern('FSH',
        ['Follicle Stimulating Hormone', 'Follicle-Stimulating Hormone'],
        '(?:IU\\/L|mIU\\/mL)',
        'IU/L'
    ),
    'LH': createLabPattern('LH',
        ['Luteinizing Hormone', 'Luteinising Hormone'],
        '(?:IU\\/L|mIU\\/mL)',
        'IU/L'
    ),
    'Progesterone': createLabPattern('Progesterone',
        ['P4'],
        '(?:nmol\\/L|ng\\/mL)',
        'nmol/L'
    ),
    'Cortisol': createLabPattern('Cortisol',
        ['Serum Cortisol', 'Plasma Cortisol'],
        '(?:nmol\\/L|μg\\/dL)',
        'nmol/L'
    ),
    'Growth Hormone': createLabPattern('Growth Hormone',
        ['GH', 'Somatotropin'],
        '(?:μg\\/L|ng\\/mL)',
        'μg/L'
    ),
    'Insulin-like Growth Factor (IGF-1)': createLabPattern('Insulin-like Growth Factor',
        ['IGF-1', 'IGF1', 'Somatomedin C'],
        '(?:nmol\\/L|ng\\/mL)',
        'nmol/L'
    ),
    'Parathyroid Hormone': createLabPattern('Parathyroid Hormone',
        ['PTH', 'Parathormone'],
        '(?:pmol\\/L|pg\\/mL)',
        'pmol/L'
    ),
    
    // Additional Immunity/Inflammation Markers
    'hsCRP': createLabPattern('hsCRP',
        ['High Sensitivity CRP', 'High-Sensitivity C-Reactive Protein', 'hs-CRP'],
        '(?:mg\\/L)',
        'mg/L'
    ),
    'Homocysteine': createLabPattern('Homocysteine',
        ['Hcy'],
        '(?:μmol\\/L|mg\\/L)',
        'μmol/L'
    ),
    'IL-6': createLabPattern('IL-6',
        ['Interleukin 6', 'Interleukin-6'],
        '(?:pg\\/mL)',
        'pg/mL'
    ),
    'TNF-alpha': createLabPattern('TNF-alpha',
        ['TNF-α', 'Tumor Necrosis Factor Alpha', 'Tumour Necrosis Factor Alpha'],
        '(?:pg\\/mL)',
        'pg/mL'
    ),
    'Fibrinogen': createLabPattern('Fibrinogen',
        ['Factor I'],
        '(?:g\\/L|mg\\/dL)',
        'g/L'
    ),
    'Complement C3': createLabPattern('Complement C3',
        ['C3'],
        '(?:g\\/L|mg\\/dL)',
        'g/L'
    ),
    'Complement C4': createLabPattern('Complement C4',
        ['C4'],
        '(?:g\\/L|mg\\/dL)',
        'g/L'
    ),
    'ESR': createLabPattern('ESR',
        ['Erythrocyte Sedimentation Rate', 'Sed Rate'],
        '(?:mm\\/hr|mm\\/h)',
        'mm/hr'
    ),
    
    // Additional Autoimmunity Markers
    'Anti-TPO': createLabPattern('Anti-TPO',
        ['TPO Antibodies', 'Thyroid Peroxidase Antibodies'],
        '(?:IU\\/mL|kIU\\/L)',
        'IU/mL'
    ),
    'Anti-TG': createLabPattern('Anti-TG',
        ['TG Antibodies', 'Thyroglobulin Antibodies'],
        '(?:IU\\/mL|kIU\\/L)',
        'IU/mL'
    ),
    'ANA': createLabPattern('ANA',
        ['Antinuclear Antibodies', 'Antinuclear Antibody'],
        '(?:titer|ratio)',
        'titer'
    ),
    'Rheumatoid Factor': createLabPattern('Rheumatoid Factor',
        ['RF'],
        '(?:IU\\/mL|kIU\\/L)',
        'IU/mL'
    ),
    'Anti-CCP': createLabPattern('Anti-CCP',
        ['Cyclic Citrullinated Peptide Antibodies', 'CCP Antibodies'],
        '(?:U\\/mL)',
        'U/mL'
    ),
    'ENA Panel': createLabPattern('ENA Panel',
        ['Extractable Nuclear Antigen Panel', 'ENA'],
        '',
        'panel'
    ),
    
    // Additional Blood Markers
    'Hematocrit': createLabPattern('Hematocrit',
        ['HCT', 'Crit', 'Packed Cell Volume', 'PCV'],
        '%',
        '%'
    ),
    'Reticulocyte Count': createLabPattern('Reticulocyte Count',
        ['Retic Count', 'Reticulocytes'],
        '(?:%|×10⁹\\/L)',
        '%'
    ),
    'Haptoglobin': createLabPattern('Haptoglobin',
        ['Hp'],
        '(?:g\\/L|mg\\/dL)',
        'g/L'
    ),
    
    // Nutrients
    'Vitamin D': createLabPattern('Vitamin D',
        ['25-OH Vitamin D', '25-Hydroxyvitamin D', '25(OH)D'],
        '(?:nmol\\/L|ng\\/mL)',
        'nmol/L'
    ),
    'Vitamin B12': createLabPattern('Vitamin B12',
        ['Cobalamin'],
        '(?:pmol\\/L|pg\\/mL)',
        'pmol/L'
    ),
    'Folate': createLabPattern('Folate',
        ['Folic Acid', 'Vitamin B9'],
        '(?:nmol\\/L|ng\\/mL)',
        'nmol/L'
    ),
    'Vitamin B6': createLabPattern('Vitamin B6',
        ['Pyridoxine'],
        '(?:nmol\\/L|ng\\/mL)',
        'nmol/L'
    ),
    'Vitamin C': createLabPattern('Vitamin C',
        ['Ascorbic Acid'],
        '(?:μmol\\/L|mg\\/dL)',
        'μmol/L'
    ),
    'Vitamin E': createLabPattern('Vitamin E',
        ['Alpha-Tocopherol'],
        '(?:μmol\\/L|mg\\/dL)',
        'μmol/L'
    ),
    'Vitamin K': createLabPattern('Vitamin K',
        ['Phylloquinone'],
        '(?:nmol\\/L|ng\\/mL)',
        'nmol/L'
    ),
    'Vitamin A': createLabPattern('Vitamin A',
        ['Retinol'],
        '(?:μmol\\/L|μg\\/dL)',
        'μmol/L'
    ),
    'Iron': createLabPattern('Iron',
        ['Serum Iron', 'Fe'],
        '(?:μmol\\/L|μg\\/dL)',
        'μmol/L'
    ),
    'Ferritin': createLabPattern('Ferritin',
        ['Serum Ferritin'],
        '(?:μg\\/L|ng\\/mL)',
        'μg/L'
    ),
    'TIBC': createLabPattern('TIBC',
        ['Total Iron Binding Capacity'],
        '(?:μmol\\/L|μg\\/dL)',
        'μmol/L'
    ),
    'TSAT': createLabPattern('TSAT',
        ['Transferrin Saturation', 'Iron Saturation'],
        '%',
        '%'
    ),
    'Zinc': createLabPattern('Zinc',
        ['Zn'],
        '(?:μmol\\/L|μg\\/dL)',
        'μmol/L'
    ),
    'Selenium': createLabPattern('Selenium',
        ['Se'],
        '(?:μmol\\/L|μg\\/L)',
        'μmol/L'
    ),
    'CoEnzyme Q10': createLabPattern('CoEnzyme Q10',
        ['CoQ10', 'Ubiquinone'],
        '(?:μmol\\/L|mg\\/L)',
        'μmol/L'
    ),
    'Copper': createLabPattern('Copper',
        ['Cu'],
        '(?:μmol\\/L|μg\\/dL)',
        'μmol/L'
    ),
    'Iodine': createLabPattern('Iodine',
        ['I'],
        '(?:μg\\/L|nmol\\/L)',
        'μg/L'
    ),
    'Omega-3 Index': createLabPattern('Omega-3 Index',
        ['Omega 3 Index', 'EPA+DHA'],
        '%',
        '%'
    ),
    
    // Additional Electrolytes
    'Chloride': createLabPattern('Chloride',
        ['Cl', 'Cl-'],
        '(?:mmol\\/L|mEq\\/L)',
        'mmol/L'
    ),
    'Bicarbonate': createLabPattern('Bicarbonate',
        ['HCO3', 'CO2', 'Carbon Dioxide'],
        '(?:mmol\\/L|mEq\\/L)',
        'mmol/L'
    ),
    'Phosphate': createLabPattern('Phosphate',
        ['PO4', 'Inorganic Phosphate'],
        '(?:mmol\\/L|mg\\/dL)',
        'mmol/L'
    ),
    'Magnesium': createLabPattern('Magnesium',
        ['Mg', 'Mg2+'],
        '(?:mmol\\/L|mg\\/dL)',
        'mmol/L'
    ),
    
    // Bone Health
    'Alkaline Phosphatase (Bone-Specific)': createLabPattern('Alkaline Phosphatase Bone-Specific',
        ['Bone ALP', 'BALP', 'Bone-Specific ALP'],
        '(?:U\\/L|μg\\/L)',
        'U/L'
    ),
    'Osteocalcin': createLabPattern('Osteocalcin',
        ['OC', 'BGP', 'Bone Gla Protein'],
        '(?:μg\\/L|ng\\/mL)',
        'μg/L'
    ),
    'N-telopeptide': createLabPattern('N-telopeptide',
        ['NTx', 'N-terminal Telopeptide'],
        '(?:nmol\\/L|ng\\/mL)',
        'nmol/L'
    ),
    
    // Cancer Markers
    'PSA': createLabPattern('PSA',
        ['Prostate Specific Antigen', 'Prostate-Specific Antigen'],
        '(?:μg\\/L|ng\\/mL)',
        'μg/L'
    ),
    'CEA': createLabPattern('CEA',
        ['Carcinoembryonic Antigen'],
        '(?:μg\\/L|ng\\/mL)',
        'μg/L'
    ),
    'CA-125': createLabPattern('CA-125',
        ['Cancer Antigen 125', 'CA 125'],
        '(?:U\\/mL|kU\\/L)',
        'U/mL'
    ),
    'AFP': createLabPattern('AFP',
        ['Alpha-Fetoprotein', 'Alpha Fetoprotein'],
        '(?:μg\\/L|ng\\/mL)',
        'μg/L'
    ),
    'CA 19-9': createLabPattern('CA 19-9',
        ['Cancer Antigen 19-9', 'CA19-9'],
        '(?:U\\/mL|kU\\/L)',
        'U/mL'
    ),
    
    // Gut Health Markers
    'Calprotectin': createLabPattern('Calprotectin',
        ['Fecal Calprotectin'],
        '(?:μg\\/g)',
        'μg/g'
    ),
    'Zonulin': createLabPattern('Zonulin',
        ['Serum Zonulin'],
        '(?:ng\\/mL)',
        'ng/mL'
    ),
    'Secretory IgA': createLabPattern('Secretory IgA',
        ['SIgA', 'S-IgA'],
        '(?:mg\\/dL|g\\/L)',
        'mg/dL'
    ),
    'Short Chain Fatty Acids': createLabPattern('Short Chain Fatty Acids',
        ['SCFA', 'SCFAs'],
        '(?:μmol\\/g|mmol\\/kg)',
        'μmol/g'
    ),
    
    // Heavy Metals
    'Lead': createLabPattern('Lead',
        ['Pb'],
        '(?:μg\\/dL|μmol\\/L)',
        'μg/dL'
    ),
    'Mercury': createLabPattern('Mercury',
        ['Hg'],
        '(?:μg\\/L|nmol\\/L)',
        'μg/L'
    ),
    'Arsenic': createLabPattern('Arsenic',
        ['As'],
        '(?:μg\\/L|nmol\\/L)',
        'μg/L'
    ),
    'Cadmium': createLabPattern('Cadmium',
        ['Cd'],
        '(?:μg\\/L|nmol\\/L)',
        'μg/L'
    ),
    'Aluminum': createLabPattern('(?:Aluminum|Al(?:\\s|$))', // Only match "Al" if followed by space or end of string
        ['Aluminium'], // Use full name alternates only
        '(?:μg\\/L|nmol\\/L)',
        'μg/L'
    ),
};

const enhancedPatterns = {
    'Testosterone': {
        regex: /Testosterone(?:\s*\(Final\))?\s*[^\n]*?\s*([\d.]+)\s*(?:nmol\/L|nmol\/l)/i,
        // regex: /Testosterone\s*(?:\(Final\))?\s*[^\n]*?\s*([\d.]+)\s*nmol\/L/i,
        standardUnit: 'nmol/L',
        precision: 2,
        alternateNames: ['Total Testosterone'],
    },
    'Bioavailable Testosterone': {
        regex: /Bioavailable\s+Testosterone\s*(?:\(Final\))?\s*[^\n]*?\s*([\d.]+)\s*nmol\/L/i,
        standardUnit: 'nmol/L',
        precision: 2
    },
    'C-Reactive Protein': {
        regex: /C-Reactive\s+Protein(?:[^:\n]*?:|)\s*(?:[LEH]\s*)?(\d+\.?\d*)\s*(?:mg\/L|mg\/l)/i,
        standardUnit: 'mg/L',
        alternateNames: ['CRP', 'C Reactive Protein', 'C REACTIVE PROTEIN'],
        fuzzyThreshold: 0.85
    },
    'HDL-C': {
        regex: /HDL[-\s](?:C|Cholesterol)(?:[^:\n]*?:|)\s*(?:[LEH]\s*)?(\d+\.?\d*)\s*(?:mmol\/L|mg\/dL)/i,
        standardUnit: 'mmol/L',
        precision: 2,
        alternateNames: ['HDL', 'High Density Lipoprotein', 'HDL Cholesterol']
    },
    'LDL-C': {
        regex: /LDL[-\s](?:C|Cholesterol)(?:[^:\n]*?:|)\s*(?:[LEH]\s*)?(\d+\.?\d*)\s*(?:mmol\/L|mg\/dL)/i,
        standardUnit: 'mmol/L',
        precision: 2,
        alternateNames: ['LDL', 'Low Density Lipoprotein', 'LDL Cholesterol']
    },
    'HbA1c': {
        regex: /(?:HbA1c|Hemoglobin\s+A1c|A1c)(?:[^:\n]*?:|)\s*(?:[LEH]\s*)?(\d+\.?\d*)\s*\%/i,
        standardUnit: '%',
        precision: 1,
        alternateNames: ['Glycated Hemoglobin', 'Hemoglobin A1C']
    },
    'TSH': {
        regex: /TSH(?:[^:\n]*?:|)\s*(?:[LEH]\s*)?(\d+\.?\d*)\s*(?:mIU\/L|μIU\/mL)/i,
        standardUnit: 'mIU/L',
        precision: 2,
        alternateNames: ['Thyroid Stimulating Hormone', 'Thyrotropin']
    },
    'Creatinine': {
        regex: /Creatinine(?:[^:\n]*?:|)\s*(?:[LEH]\s*)?(\d+\.?\d*)\s*(?:umol\/L|μmol\/L|mg\/dL)/i,
        standardUnit: 'μmol/L',
        precision: 0,
        alternateNames: ['Creat', 'Serum Creatinine']
    },
    'SHBG': {
        regex: /Sex Hormone Binding Globulin\s*(?:[HLN]\s*)?([\d.]+)\s*(?:[\s\S]*?)((?:\d+\.?\d*\s*[-–]\s*\d+\.?\d*))\s*nmol\/L/i,
        standardUnit: 'nmol/L',
        precision: 1,
        alternateNames: ['Sex Hormone Binding Globulin'],
        referencePattern: /([\d.]+\s*[-–]\s*[\d.]+)/i
    },
};

const structuredTestPatterns = {
    'SHBG': {
        regex: /Sex\s+Hormone\s+Binding\s+Globulin(?:\s*\(?Final\)?)?\s*(?:[HLN]\s*)?([\d.]+)[\s\S]*?(?:nmol\/L)/i,
        standardUnit: 'nmol/L',
        precision: 1,
        referencePattern: /(?:13\.5\s*[-–]\s*71\.0|(?:\d+\.\d+)\s*[-–]\s*(?:\d+\.\d+))/i
    },
    'Testosterone Bioavailable': {
        regex: /TESTOSTERONE\s+BIOAVAILABLE[\s\S]*?RESULT\s*([\d.]+)[\s\S]*?(?:nmol\/L)/i,
        standardUnit: 'nmol/L',
        precision: 1,
        referencePattern: /REFERENCE\s*([\d.-]+)/i
    },
    'T4 Free': {
        regex: /T4\s+FREE[\s\S]*?RESULT\s*([\d.]+)[\s\S]*?(?:pmol\/L)/i,
        standardUnit: 'pmol/L',
        precision: 1,
        referencePattern: /REFERENCE\s*([\d.-]+)/i
    },
    'FSH': {
        regex: /FSH[\s\S]*?RESULT\s*([\d.]+)[\s\S]*?(?:[IU]U\/L)/i,
        standardUnit: 'IU/L',
        precision: 1,
        referencePattern: /REFERENCE\s*([\d.-]+)/i
    },
    'TSH': {
        regex: /TSH[\s\S]*?RESULT\s*([\d.]+)[\s\S]*?(?:m[IU]U\/L)/i,
        standardUnit: 'mIU/L',
        precision: 1,
        referencePattern: /REFERENCE\s*([\d.-]+)/i
    },
    // Additional structured test patterns for common biomarkers
    'LH': {
        regex: /LH[\s\S]*?RESULT\s*([\d.]+)[\s\S]*?(?:[IU]U\/L)/i,
        standardUnit: 'IU/L',
        precision: 1,
        referencePattern: /REFERENCE\s*([\d.-]+)/i
    },
    'Estradiol': {
        regex: /ESTRADIOL[\s\S]*?RESULT\s*([\d.]+)[\s\S]*?(?:pmol\/L|pg\/mL)/i,
        standardUnit: 'pmol/L',
        precision: 1,
        referencePattern: /REFERENCE\s*([\d.-]+)/i
    },
    'Progesterone': {
        regex: /PROGESTERONE[\s\S]*?RESULT\s*([\d.]+)[\s\S]*?(?:nmol\/L|ng\/mL)/i,
        standardUnit: 'nmol/L',
        precision: 1,
        referencePattern: /REFERENCE\s*([\d.-]+)/i
    },
    'Vitamin D, 25-Hydroxy': {
        regex: /(?:VITAMIN D|25-HYDROXY VITAMIN D)[\s\S]*?RESULT\s*([\d.]+)[\s\S]*?(?:nmol\/L|ng\/mL)/i,
        standardUnit: 'nmol/L',
        precision: 1,
        referencePattern: /REFERENCE\s*([\d.-]+)/i
    },
    'Hemoglobin A1c': {
        regex: /(?:HBA1C|HEMOGLOBIN A1C|GLYCATED HEMOGLOBIN)[\s\S]*?RESULT\s*([\d.]+)[\s\S]*?(?:%|mmol\/mol)/i,
        standardUnit: '%',
        precision: 1,
        referencePattern: /REFERENCE\s*([\d.-]+)/i
    },
    'Ferritin': {
        regex: /FERRITIN[\s\S]*?RESULT\s*([\d.]+)[\s\S]*?(?:μg\/L|ng\/mL)/i,
        standardUnit: 'μg/L',
        precision: 1,
        referencePattern: /REFERENCE\s*([\d.-]+)/i
    }
};

// Add fuzzy matching capability
function levenshteinDistance(a, b) {
    const matrix = Array(b.length + 1).fill().map(() => Array(a.length + 1).fill(0));
    
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j - 1][i] + 1,
                matrix[j][i - 1] + 1,
                matrix[j - 1][i - 1] + cost
            );
        }
    }
    
    return matrix[b.length][a.length];
}

function findBestMatch(text, patterns) {
    let bestMatch = null;
    let bestScore = Infinity;
    
    for (const [name, pattern] of Object.entries(patterns)) {
        const allNames = [name, ...pattern.alternateNames];
        
        for (const patternName of allNames) {
            const distance = levenshteinDistance(text.toLowerCase(), patternName.toLowerCase());
            const score = distance / Math.max(text.length, patternName.length);
            
            if (score < bestScore && score <= (1 - pattern.fuzzyThreshold)) {
                bestScore = score;
                bestMatch = name;
            }
        }
    }
    
    return bestMatch;
}

const datePatterns = [
    {
        key: 'Collection Date',
        regex: /Collection Date:?\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4}|\d{2}\/\d{2}\/\d{4}|\d{4}\/\d{2}\/\d{2}|\d{4}-[A-Za-z]{3}-\d{2}|\d{2}-[A-Za-z]{3}-\d{4})/i,
        priority: 1
    },
    {
        key: 'Date',
        regex: /Date:?\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4}|\d{2}\/\d{2}\/\d{4}|\d{4}\/\d{2}\/\d{2}|\d{4}-[A-Za-z]{3}-\d{2}|\d{2}-[A-Za-z]{3}-\d{4})/i,
        priority: 2
    },
    {
        key: 'Collection Date',
        regex: /Collection Date:?\s*(\d{4}-[A-Za-z]{3}-\d{2}|\d{2}-[A-Za-z]{3}-\d{4})\s*(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?/i,
        priority: 3
    },
    {
        key: 'Collected Date',
        regex: /Collected Date:?\s*(\d{2}-[A-Za-z]{3}-\d{4}|\d{4}-[A-Za-z]{3}-\d{2})\s*(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?/i,
        priority: 4
    },
    {
        key: 'Generated On',
        regex: /Generated On:?\s*(\d{4}-[A-Za-z]{3}-\d{2}|\d{2}-[A-Za-z]{3}-\d{4})\s*(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?/i,
        priority: 5
    },
    {
        key: 'Received Date',
        regex: /Received Date:?\s*(\d{2}-[A-Za-z]{3}-\d{4}|\d{4}-[A-Za-z]{3}-\d{2})\s*(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?/i,
        priority: 6
    },
    {
        key: 'Updated On',
        regex: /Updated On:?\s*(\d{4}-[A-Za-z]{3}-\d{2}|\d{2}-[A-Za-z]{3}-\d{4})\s*(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?/i,
        priority: 7
    },
    {
        key: 'Last Update Date',
        regex: /Last Update Date:?\s*(\d{2}-[A-Za-z]{3}-\d{4}|\d{4}-[A-Za-z]{3}-\d{2})\s*(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?/i,
        priority: 8
    }
];

module.exports = { 
    createStructuredLabPattern,
    labPatterns, 
    datePatterns,
    enhancedPatterns,
    structuredTestPatterns,
    findBestMatch,
    levenshteinDistance
};