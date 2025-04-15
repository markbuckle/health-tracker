function createLabPattern(name, alternateNames, unit, displayUnit) {
    const namePattern = [name, ...alternateNames]
        .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');
    
    return {
        regex: new RegExp(
            `(?:${namePattern})` +               // Main name or alternates
            '\\s*:?\\s*' +                       // Optional colon with flexible spacing
            '(?:[LEH]\\s*)?'+                    // Optional flags (Low/Elevated/High)
            '(\\d+\\.?\\d*)\\s*' +              // The value (capture group 1)
            '(?:' +                              // Non-capturing group for units/ranges
                '(?:\\d+\\.?\\d*\\s*[-–]\\s*\\d+\\.?\\d*)?\\s*' + // Optional reference range
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
        '',
        ''
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
    // 'Bioavailable Testosterone': createLabPattern('Bioavailable Testosterone',
    //     ['Bio Testosterone', 'Bioavailable T'],
    //     'nmol\\/L',
    //     'nmol/L'
    // ),
    // 'SHBG': createLabPattern('(?:SHBG|Sex Hormone Binding Globulin)',
    //     ['Sex Hormone Binding Protein'],
    //     'nmol\\/L',
    //     'nmol/L'
    // ),
    'C-Peptide': createLabPattern('C-Peptide',
        ['C Peptide'],
        'pmol\\/L',
        'pmol/L'
    ),
    'FSH': createLabPattern(
        'FSH',
        ['Follicle Stimulating Hormone', 'FaH', 'F.H'],
        '(?:IU\\/L|IU\\/l|IUL|ILE|MAT)',
        'IU/L'
    ),
    'LH': createLabPattern(
        'LH',
        ['Luteinizing Hormone'],
        '(?:IU\\/L|IU\\/l|IUL|FLL)',
        'IU/L'
    ),
    'Prolactin': createLabPattern(
        'Prolactin',
        ['Prolagtin', 'Prclactin'],
        '(?:ug\\/L|ug\\/l|ugfl|ug/L)',
        'ug/L'
    ),
    'PSA': createLabPattern(
        'PSA Screening',
        ['Prostate Specific Antigen', 'PSA', 'FSA Sereening', 'FSA Screening'],
        '(?:ug\\/L|ug\\/l|ugfl|ul|d)',
        'ug/L'
    ),
    'Vitamin D': createLabPattern(
        'Vit D 25-hydroxy',
        ['Vitamin D', '25-hydroxy Vitamin D', '25(OH)D', 'WitD 25kydroxy', 'VitD 25hydroxy U'],
        '(?:nmol\\/L|nmol\\/l|nmolL|mrnokL)',
        'nmol/L'
    ),
    'Thyroperoxidase Antibody': createLabPattern(
        'Thyroperoxidase Antibody',
        ['THYROPEROXIDASE ANTIBODY', 'TPO Antibody', 'TPO Ab'],
        'kIU\\/L',
        'kIU/L'
    ),
    // inflammation
    'C Reactive Protein': createLabPattern(
        'C Reactive Protein',
        ['C REACTIVE PROTEIN', 'CRP', 'C-Reactive Protein', 'REACTIVE PROTEIN'],
        'mg\\/L',
        'mg/L'
    )
};

const enhancedTestosteronePatterns = {
    'Testosterone': {
        regex: /Testosterone\s*(?:\(Final\))?\s*(\d+\.\d+)(?:\s+\d+\.\d+\s*[-–]\s*\d+\.\d+)?\s*nmol\/L/i,
        standardUnit: 'nmol/L',
        precision: 2
    },
    // 'Testosterone': {
    //     regex: /Testosterone\s*(?:\(Final\))?\s*[^\n]*?\s*([\d.]+)\s*nmol\/L/i,
    //     standardUnit: 'nmol/L',
    //     precision: 2
    // },
    'Bioavailable Testosterone': {
        regex: /Bioavailable\s+Testosterone\s*(?:\(Final\))?\s*[^\n]*?\s*([\d.]+)\s*nmol\/L/i,
        standardUnit: 'nmol/L',
        precision: 2
    }
};

const structuredTestPatterns = {
    'Sex Hormone Binding Globulin': {
        regex: /SEX\s+HORMONE\s+BINDING\s+GLOBULIN[\s\S]*?RESULT\s*([\d.]+)[\s\S]*?(?:nmol\/L)/i,
        standardUnit: 'nmol/L',
        precision: 1,
        referencePattern: /REFERENCE\s*([\d.-]+)/i
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
    'PSA': {
        regex: /FSA\s+Sereening\s+(?:\(?\w+\)?)?\s+(\d+\.\d+)/i,
        standardUnit: 'ug/L',
        precision: 2
    },
    'VitaminD': {
        regex: /[A-Za-z]+D\s+\d+[a-z]+\s+[A-Za-z]\s+(\d+)\s+[a-z]+L/i,
        standardUnit: 'nmol/L',
        precision: 0
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
        regex: /Collection Date:?\s*(\d{4}-[A-Za-z]{3}-\d{2}|\d{2}-[A-Za-z]{3}-\d{4})\s*(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?/i,
        priority: 1
    },
    {
        key: 'Collected Date',
        regex: /Collected Date:?\s*(\d{2}-[A-Za-z]{3}-\d{4}|\d{4}-[A-Za-z]{3}-\d{2})\s*(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?/i,
        priority: 2
    },
    {
        key: 'Generated On',
        regex: /Generated On:?\s*(\d{4}-[A-Za-z]{3}-\d{2}|\d{2}-[A-Za-z]{3}-\d{4})\s*(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?/i,
        priority: 3
    },
    {
        key: 'Received Date',
        regex: /Received Date:?\s*(\d{2}-[A-Za-z]{3}-\d{4}|\d{4}-[A-Za-z]{3}-\d{2})\s*(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?/i,
        priority: 4
    },
    {
        key: 'Updated On',
        regex: /Updated On:?\s*(\d{4}-[A-Za-z]{3}-\d{2}|\d{2}-[A-Za-z]{3}-\d{4})\s*(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?/i,
        priority: 5
    },
    {
        key: 'Last Update Date',
        regex: /Last Update Date:?\s*(\d{2}-[A-Za-z]{3}-\d{4}|\d{4}-[A-Za-z]{3}-\d{2})\s*(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?/i,
        priority: 6
    }
];

module.exports = { 
    labPatterns, 
    datePatterns,
    enhancedTestosteronePatterns,
    structuredTestPatterns,
};