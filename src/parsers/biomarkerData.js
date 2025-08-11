// biomarkerData

const markerCategories = {
  cardiovascular: {
    name: "Cardiovascular",
    description: "Markers related to heart and blood vessel health"
  },
  metabolic: {
    name: "Metabolic",
    description: "Markers related to energy processing and metabolic health"
  },
  immunity: {
    name: "Immunity",
    description: "Markers related to inflammation and immune system regulation"
  },
  autoimmunity: {
    name: "Autoimmunity",
    description: "Markers related to autoimmunity"
  },
  liver: {
    name: "Liver",
    description: "Markers related to liver health and function"
  },
  kidney: {
    name: "Kidney",
    description: "Markers related to kidney health and function"
  },
  pancreas: {
    name: "Pancreas",
    description: "Markers related to pancreas health and function"
  },
  hormones: {
    name: "Hormones",
    description: "Endocrine system and hormone levels"
  },
  blood: {
    name: "Blood",
    description: "Blood function and related markers"
  },
  nutrients: {
    name: "Nutrients",
    description: "Plasma nutrient detection"
  },
  electrolytes: {
    name: "Electrolytes",
    description: "Plasma nutrient detection"
  },
  bone: {
    name: "Bone",
    description: "Bone health"
  },
  cancer: {
    name: "Cancer",
    description: "Cancer detection"
  },
  gut: {
    name: "Gut Microbiome",
    description: "Gut microbiome health"
  },
  metals: {
    name: "Heavy Metals",
    description: "Plasma heavy metal detection"
  }
};

// Updated biomarkerData.js with comprehensive alternate names and missing biomarkers

const biomarkerData = {
  // Cardiovascular (Updated with alternate names)
  "Apo-B": {
    category: "cardiovascular",
    description: "Apolipoprotein B (Apo-B) is the main component of atherogenesis (plaque building). It represents the total atherogenic particles in circulation.",
    link: "https://www.thelancet.com/journals/lanhl/article/PIIS2666-7568(21)00120-3/fulltext",
    frequency: "quarterly/annually",
    id: "1",
    alternateNames: ["apob", "apolipoprotein b", "apo b", "apolipoprotein b-100", "apolipoprotein-b"],
    recommendation: {
      priority: 'high',
      category: 'Cardiovascular Risk',
      explanation: 'ApoB provides a more accurate assessment of cardiovascular risk than standard cholesterol panels. It counts the actual number of atherogenic particles that can penetrate artery walls, making it especially important for people with diabetes, metabolic syndrome, or family history of heart disease.',
      aliases: ['apob', 'apolipoprotein b', 'apo b', 'apolipoprotein b-100', 'apolipoprotein-b']
    }
  },
  "ApoA1": {
    category: "cardiovascular",
    description: "Apolipoprotein A1 is the main protein component of HDL cholesterol. Higher levels are associated with reduced cardiovascular risk.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["apoa1", "apo a1", "apolipoprotein a1", "apolipoprotein a-1", "apo-a1"]
  },
  "Lp(a)": {
    category: "cardiovascular",
    description: "Lipoprotein(a) [Lp(a)] is an atherogenic lipoprotein with a strong genetic regulation.",
    link: "https://peterattiamd.com/high-lpa-risk-factors/",
    frequency: "one-time",
    id: "2",
    alternateNames: ["lp(a)", "lipoprotein(a)", "lipoprotein a", "lp a", "lpa", "lp-a"],
    recommendation: {
      priority: 'high',
      category: 'Cardiovascular Risk',
      explanation: 'Lp(a) is a genetically determined risk factor for cardiovascular disease that affects about 20% of the population. Unlike other cholesterol markers, Lp(a) levels are largely inherited and remain stable throughout life. High levels significantly increase heart attack and stroke risk.',
      aliases: ['lp(a)', 'lipoprotein(a)', 'lipoprotein a', 'lp a', 'lpa', 'lp-a']
    }
  },
  "LDL-C": {
    category: "cardiovascular",
    description: "Low-density lipoprotein cholesterol (LDL-C) is often referred to as 'bad' cholesterol as it can build up in your arteries.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["ldl cholesterol", "ldl", "low density lipoprotein", "bad cholesterol", "ldl-cholesterol"]
  },
  "HDL-C": {
    category: "cardiovascular", 
    description: "High-density lipoprotein cholesterol (HDL-C) is known as 'good' cholesterol as it helps remove other forms of cholesterol from your bloodstream.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["hdl cholesterol", "hdl", "high density lipoprotein", "good cholesterol", "hdl-cholesterol"]
  },
  "Triglycerides": {
    category: "cardiovascular",
    description: "A type of fat in your blood that your body uses for energy.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["triglyceride", "trig", "trigs", "tg"]
  },
  "Non-HDL-C": {
    category: "cardiovascular",
    description: "Represents all 'bad' cholesterol types combined.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["non-hdl cholesterol", "non hdl", "non-hdl", "non hdl cholesterol"]
  },
  "VLDL-C": {
    category: "cardiovascular",
    description: "Very low-density lipoprotein cholesterol, carries triglycerides through your blood.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["vldl cholesterol", "vldl", "very low density lipoprotein", "vldl-cholesterol"]
  },
  "Total Cholesterol": {
    category: "cardiovascular",
    description: "The total amount of cholesterol in your blood, including both LDL and HDL.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["cholesterol", "total chol", "tc", "cholesterol total"]
  },
  "TC/HDL-C": {
    category: "cardiovascular",
    description: "Ratio of total cholesterol to HDL, an important predictor of cardiovascular risk.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["cholesterol ratio", "total cholesterol/hdl ratio", "tc/hdl ratio", "chol/hdl ratio"]
  },
  "LDL Particle Number": {
    category: "cardiovascular",
    description: "Count of LDL particles in blood. More predictive of cardiovascular risk than LDL-C concentration alone.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["ldl-p", "ldl particle count", "ldl particles"]
  },
  "LDL Particle Size": {
    category: "cardiovascular",
    description: "Measures the size of LDL particles. Small, dense LDL particles are associated with higher cardiovascular risk.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["ldl size", "ldl particle size", "small dense ldl"]
  },
  "HDL Particle Number": {
    category: "cardiovascular",
    description: "Count of HDL particles in blood. May provide additional insight into cardiovascular risk beyond HDL-C.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["hdl-p", "hdl particle count", "hdl particles"]
  },
  "oxLDL": {
    category: "cardiovascular",
    description: "Oxidized LDL, a marker of oxidative stress and inflammation associated with atherosclerosis.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["oxidized ldl", "ox-ldl", "oxidized low density lipoprotein"]
  },
  "PCSK9": {
    category: "cardiovascular",
    description: "Proprotein convertase subtilisin/kexin type 9, regulates LDL receptor recycling and affects LDL levels.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["pcsk-9", "proprotein convertase subtilisin/kexin type 9"]
  },

  // Metabolic (Updated with alternate names)
  "HbA1C": {
    category: "metabolic",
    description: "Measures your average blood sugar levels over the past 2-3 months.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["hba1c", "hemoglobin a1c", "glycated hemoglobin", "a1c", "hgba1c", "glycohemoglobin"],
    recommendation: {
      priority: 'high',
      category: 'Metabolic Health',
      explanation: 'HbA1c reflects your average blood sugar levels over the past 2-3 months. It\'s crucial for detecting prediabetes and monitoring diabetes risk, even before fasting glucose becomes abnormal. Elevated levels increase cardiovascular disease risk.',
      aliases: ['hba1c', 'hemoglobin a1c', 'glycated hemoglobin', 'a1c', 'hgba1c']
    }
  },
  "Fasting Blood Glucose": {
    category: "metabolic",
    description: "Blood sugar level when you haven't eaten for at least 8 hours.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["glucose", "fasting glucose", "blood glucose", "blood sugar", "fbg", "fbs"]
  },
  // ADD MISSING: Regular Glucose (from lab report)
  "Glucose": {
    category: "metabolic",
    description: "Blood sugar level. Elevated levels may indicate diabetes or prediabetes.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["blood glucose", "blood sugar", "serum glucose", "plasma glucose"]
  },
  "Fasting Insulin": {
    category: "metabolic",
    description: "Measures insulin levels when you haven't eaten, helping assess insulin sensitivity.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["insulin", "fasting insulin level", "serum insulin"]
  },
  "HOMA-IR": {
    category: "metabolic",
    description: "Homeostatic Model Assessment of Insulin Resistance, calculated from fasting glucose and insulin to assess insulin resistance.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["homa ir", "homa-ir", "insulin resistance index"]
  },
  "Adiponectin": {
    category: "metabolic",
    description: "Hormone produced by fat cells that regulates glucose levels and fatty acid breakdown. Higher levels are associated with improved insulin sensitivity.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["adiponectin hormone", "acrp30"]
  },
  "Leptin": {
    category: "metabolic",
    description: "Hormone produced by fat cells that helps regulate energy balance by inhibiting hunger. Resistance can lead to obesity.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["leptin hormone", "ob protein"]
  },
  "GGT/AST Ratio": {
    category: "metabolic",
    description: "Ratio of gamma-glutamyl transferase to aspartate aminotransferase, used as a marker for insulin resistance and fatty liver.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["ggt ast ratio", "gamma gt/ast ratio"]
  },

  // Immune/Inflammation (Updated with alternate names)
  "hsCRP": {
    category: "immunity",
    description: "High-sensitivity C-reactive protein, a marker of inflammation in your body.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["hscrp", "hs-crp", "high-sensitivity crp", "c-reactive protein", "crp high sensitivity", "hs crp", "c-reactive protein, high sensitivity"],
    recommendation: {
      priority: 'medium',
      category: 'Inflammation',
      explanation: 'hsCRP measures chronic inflammation in your body, which is a key driver of atherosclerosis and cardiovascular disease. It helps identify increased heart disease risk even when cholesterol levels are normal.',
      aliases: ['hscrp', 'hs-crp', 'high-sensitivity crp', 'c-reactive protein', 'crp high sensitivity', 'hs crp']
    }
  },
  // ADD MISSING: Regular CRP (different from hsCRP)
  "C-Reactive Protein": {
    category: "immunity",
    description: "Marker of inflammation in the body. High levels indicate increased cardiovascular risk.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["crp", "c reactive protein", "c-reactive protein", "reactive protein"]
  },
  "Homocysteine": {
    category: "immunity",
    description: "An amino acid that, when elevated, may indicate increased risk of heart disease.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["homocysteine level", "hcy", "plasma homocysteine"]
  },
  "C-Peptide": {
    category: "metabolic", // Fixed category - should be metabolic, not inflammation
    description: "Indicates how much insulin your pancreas is producing.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["c peptide", "connecting peptide", "proinsulin c-peptide"]
  },
  "IL-6": {
    category: "immunity",
    description: "Interleukin-6, a pro-inflammatory cytokine involved in immune response and inflammation. Elevated in various inflammatory conditions.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["interleukin 6", "interleukin-6", "il6"]
  },
  "TNF-alpha": {
    category: "immunity",
    description: "Tumor Necrosis Factor alpha, a pro-inflammatory cytokine involved in systemic inflammation. Elevated in chronic inflammatory diseases.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["tnf-α", "tnf alpha", "tumor necrosis factor alpha", "tnfa"]
  },
  "Fibrinogen": {
    category: "immunity",
    description: "Protein produced by the liver that helps in blood clotting. Also an acute phase reactant that increases during inflammation.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["fibrinogen level", "plasma fibrinogen"]
  },
  "Complement C3": {
    category: "immunity",
    description: "Protein involved in the complement system of immune response. Can indicate inflammation or autoimmune activity.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["c3 complement", "complement component c3", "c3"]
  },
  "Complement C4": {
    category: "immunity",
    description: "Protein involved in the complement system of immune response. Low levels may indicate autoimmune disease.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["c4 complement", "complement component c4", "c4"]
  },
  // ADD MISSING: ESR from lab report
  "Erythrocyte Sedimentation Rate": {
    category: "immunity",
    description: "Measures how quickly red blood cells settle. High levels indicate inflammation.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["esr", "sed rate", "sedimentation rate", "erythrocyte sed rate"]
  },

  // Liver (Updated with alternate names)
  "ALT": {
    category: "liver",
    description: "Alanine aminotransferase (ALT) is an enzyme primarily found in liver cells. Elevated levels may indicate liver damage.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["alt (sgpt)", "sgpt", "alanine aminotransferase", "alanine transaminase"]
  },
  "AST": {
    category: "liver",
    description: "Aspartate aminotransferase (AST) an enzyme that can indicate liver damage when elevated.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["ast (sgot)", "sgot", "aspartate aminotransferase", "aspartate transaminase"]
  },
  "ALP": {
    category: "liver",
    description: "Alkaline phosphatase, an enzyme found in liver and bones.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["alkaline phosphatase", "alk phos", "alkp"]
  },
  "GGT": {
    category: "liver",
    description: "Gamma-glutamyl transferase, an enzyme that can indicate liver disease or bile duct issues.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["gamma-glutamyl transferase", "gamma gt", "ggt", "gamma-glutamyl transpeptidase"]
  },
  "Bilirubin": {
    category: "liver",
    description: "A yellowish substance produced during red blood cell breakdown.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["total bilirubin", "tbil", "bili", "bilirubin total"]
  },
  // ADD MISSING: Total Bilirubin (specific from lab report)
  "Total Bilirubin": {
    category: "liver",
    description: "Waste product from red blood cell breakdown. High levels may indicate liver problems.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["bilirubin", "tbil", "total bili", "bilirubin total"]
  },
  "Creatine Kinase": {
    category: "blood", // Fixed category - CK is more of a muscle marker than liver
    description: "An enzyme that can indicate muscle damage when elevated.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["ck", "cpk", "creatine phosphokinase"]
  },
  "Albumin/Globulin Ratio": {
    category: "liver",
    description: "Ratio of albumin to globulin proteins in blood, used to assess liver and kidney function. Changes in this ratio can indicate liver disease or inflammation.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["a/g ratio", "albumin globulin ratio", "alb/glob ratio"]
  },
  "Total Protein": {
    category: "liver",
    description: "Measures albumin and globulin proteins in blood, helping evaluate nutritional status and liver or kidney dysfunction.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["protein", "serum protein", "total serum protein", "tp"]
  },
  "Direct Bilirubin": {
    category: "liver",
    description: "Bilirubin that has been processed by the liver. Elevated levels may indicate liver or bile duct disorders.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["conjugated bilirubin", "direct bili", "dbil"]
  },
  "Indirect Bilirubin": {
    category: "liver",
    description: "Bilirubin that hasn't been processed by the liver. Elevated levels may indicate red blood cell destruction.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["unconjugated bilirubin", "indirect bili", "ibil"]
  },

  // Kidney (Updated with alternate names)
  "Creatinine": {
    category: "kidney",
    description: "A waste product filtered by your kidneys, used to assess kidney function.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["creat", "serum creatinine", "cr", "crea"]
  },
  "Cystatin C": {
    category: "kidney",
    description: "A protein used to estimate kidney function, in many cases more accurate than creatinine.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["cystatin-c", "cys c", "cystc"]
  },
  "eGFR": {
    category: "kidney",
    description: "Estimated glomerular filtration rate, measures how well your kidneys are filtering.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["egfr", "estimated gfr", "glomerular filtration rate", "gfr"]
  },
  "Albumin": {
    category: "liver", // Albumin is primarily a liver marker, though kidney disease can affect it
    description: "A protein made by your liver, low levels can indicate liver or kidney issues.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["alb", "serum albumin", "albumin level"]
  },
  "Microalbumin": {
    category: "kidney",
    description: "Small amounts of protein in urine that can indicate early kidney damage.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["microalbuminuria", "urine microalbumin", "albumin urine"]
  },
  "BUN": {
    category: "kidney",
    description: "Blood urea nitrogen, a waste product filtered by your kidneys.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["blood urea nitrogen", "urea nitrogen", "bun level"]
  },
  "BUN/Creatinine Ratio": {
    category: "kidney",
    description: "Ratio of blood urea nitrogen to creatinine, used to differentiate between kidney and non-kidney causes of abnormal values.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["bun/creat ratio", "bun creatinine ratio", "bun:creat"]
  },
  "Uric Acid": {
    category: "kidney",
    description: "End product of purine metabolism. High levels can lead to gout and may indicate kidney dysfunction.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["urate", "serum uric acid", "uric acid level"]
  },
  "Urine pH": {
    category: "kidney",
    description: "Acidity level of urine, can indicate kidney function, metabolic conditions, or urinary tract infections.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["urine ph level", "urinary ph"]
  },

  // ADD MISSING BLOOD MARKERS from lab report
  "White Blood Cell Count": {
    category: "blood",
    description: "Measures the number of white blood cells in your blood, which help fight infections and diseases.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["wbc", "white blood cells", "leukocyte count", "white cell count"]
  },
  "Red Blood Cell Count": {
    category: "blood", 
    description: "Measures the number of red blood cells that carry oxygen throughout your body.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["rbc", "red blood cells", "erythrocyte count", "red cell count"]
  },
  "Hemoglobin": {
    category: "blood",
    description: "Protein in red blood cells that carries oxygen from lungs to body tissues. Low levels may indicate anemia.",
    frequency: "quarterly/annually", 
    link: "",
    id: "",
    alternateNames: ["hgb", "hb", "hemoglobin level"]
  },
  "Hematocrit": {
    category: "blood",
    description: "Percentage of blood volume made up of red blood cells. Low levels may indicate anemia or blood loss.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["hct", "packed cell volume", "hematocrit level"]
  },
  "Mean Corpuscular Volume": {
    category: "blood",
    description: "Average size of red blood cells. Helps classify types of anemia.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["mcv", "mean cell volume"]
  },
  "Mean Corpuscular Hemoglobin": {
    category: "blood", 
    description: "Average amount of hemoglobin in each red blood cell.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["mch", "mean cell hemoglobin"]
  },
  "Platelet Count": {
    category: "blood",
    description: "Number of platelets in blood, which help with blood clotting.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["platelets", "thrombocyte count", "plt"]
  },

  // ADD MISSING ELECTROLYTES from lab report
  "Sodium": {
    category: "electrolytes",
    description: "Essential electrolyte that helps regulate fluid balance and nerve function.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["na", "serum sodium", "sodium level"]
  },
  "Potassium": {
    category: "electrolytes", 
    description: "Essential electrolyte important for heart rhythm and muscle function.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["k", "serum potassium", "potassium level"]
  },
  "Chloride": {
    category: "electrolytes",
    description: "Electrolyte that helps maintain proper fluid balance and acid-base balance.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["cl", "serum chloride", "chloride level"]
  },
  "Carbon Dioxide": {
    category: "electrolytes",
    description: "Measures bicarbonate levels, which help maintain proper pH balance in blood.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["co2", "bicarbonate", "total co2", "bicarb"]
  },
  "Calcium": {
    category: "bone",
    description: "Essential mineral for bone health, muscle function, and nerve signaling.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["ca", "serum calcium", "calcium level"]
  },

  // Hormones (Updated with alternate names)
  "Testosterone": {
    category: "hormones",
    description: "Testosterone is a critical hormone that plays key roles in both male and female health, including muscle mass, bone density, libido, and overall well-being.",
    link: "https://peterattiamd.com/preview-ama-28-all-things-testosterone-and-testosterone-replacement-therapy/",
    id: "3",
    frequency: "quarterly/annually",
    alternateNames: ["total testosterone", "testosterone total", "t"]
  },
  "Free Testosterone": {
    category: "hormones",
    description: "The biologically active form of testosterone that's available for your body to use.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["free t", "bioavailable testosterone", "unbound testosterone"]
  },
  "SHBG": {
    category: "hormones",
    description: "Sex hormone binding globulin, controls the amount of testosterone that your tissues can use.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["sex hormone binding globulin", "sex hormone-binding globulin"]
  },
  "DHEA-S": {
    category: "hormones",
    description: "A hormone that can be converted into testosterone and estrogen.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["dheas", "dhea sulfate", "dehydroepiandrosterone sulfate"]
  },
  "TSH": {
    category: "hormones",
    description: "Thyroid stimulating hormone, controls your thyroid gland's function.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["thyroid stimulating hormone", "thyrotropin", "tsh level"]
  },
  "Free T3": {
    category: "hormones",
    description: "The active form of thyroid hormone.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["ft3", "free triiodothyronine", "t3 free"]
  },
  "Free T4": {
    category: "hormones",
    description: "The storage form of thyroid hormone.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["ft4", "free thyroxine", "t4 free", "free t4"]
  },
  "Estradiol": {
    category: "hormones",
    description: "The main form of estrogen, important for reproductive and bone health.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["e2", "estradiol level", "17β-estradiol"]
  },
  "Prolactin": {
    category: "hormones",
    description: "Hormone that stimulates breast milk production and influences reproductive function.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["prl", "prolactin level"]
  },
  "Reverse T3": {
    category: "hormones",
    description: "Inactive form of thyroid hormone that can block thyroid function when elevated.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["rt3", "reverse triiodothyronine", "r-t3"]
  },
  "FSH": {
    category: "hormones",
    description: "Follicle-stimulating hormone, regulates reproductive processes including development, growth, and reproductive functions.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["follicle stimulating hormone", "follicle-stimulating hormone"]
  },
  "LH": {
    category: "hormones",
    description: "Luteinizing hormone, stimulates ovulation in women and testosterone production in men.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["luteinizing hormone", "icsh"]
  },
  "Progesterone": {
    category: "hormones",
    description: "Hormone important for menstrual cycle and pregnancy maintenance in women.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["p4", "progesterone level"]
  },
  "Cortisol": {
    category: "hormones",
    description: "Primary stress hormone that affects metabolism, immune response, and inflammation.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["cortisol level", "serum cortisol", "hydrocortisone"]
  },
  "Growth Hormone": {
    category: "hormones",
    description: "Hormone that stimulates growth, cell reproduction, and regeneration.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["gh", "hgh", "human growth hormone", "somatotropin"]
  },
  "Insulin-like Growth Factor (IGF-1)": {
    category: "hormones",
    description: "Hormone similar to insulin that plays a key role in growth and has anabolic effects in adults.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["igf-1", "igf1", "somatomedin c", "insulin-like growth factor 1"]
  },

  // Nutrients (Updated with alternate names)
  "Zinc": {
    category: "nutrients",
    description: "Trace mineral important for immune function, wound healing, and protein synthesis.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["zn", "zinc level", "serum zinc"]
  },
  "Selenium": {
    category: "nutrients",
    description: "Trace element important for thyroid function and antioxidant defense.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["se", "selenium level", "serum selenium"]
  },
  "CoEnzyme Q10": {
    category: "nutrients",
    description: "Antioxidant that helps generate energy in cells, particularly important for heart health.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["coq10", "ubiquinone", "coenzyme q-10"]
  },
  "Vitamin D": {
    category: "nutrients",
    description: "Fat-soluble vitamin crucial for bone health, immune function, and overall health.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["vitamin d", "25-hydroxyvitamin d", "25(oh)d", "vitamin d 25-hydroxy", "vitamin d3", "25-oh vitamin d", "vitamin d, 25-hydroxy"],
    recommendation: {
      priority: 'medium',
      category: 'Nutritional Status',
      explanation: 'Vitamin D deficiency is extremely common and linked to increased risk of cardiovascular disease, osteoporosis, immune dysfunction, and mood disorders. Most people need supplementation, especially during winter months.',
      aliases: ['vitamin d', '25-hydroxyvitamin d', '25(oh)d', 'vitamin d 25-hydroxy', 'vitamin d3', '25-oh vitamin d']
    }
  },
  "Vitamin B12": {
    category: "nutrients",
    description: "Essential vitamin for nerve function and red blood cell formation.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["b12", "cobalamin", "cyanocobalamin", "vitamin b-12"]
  },
  "Vitamin A": {
    category: "nutrients",
    description: "Fat-soluble vitamin important for vision, immune function, and cell growth.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["retinol", "vitamin a level", "retinyl palmitate"]
  },
  "Iodine": {
    category: "nutrients",
    description: "Mineral essential for thyroid hormone production.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["iodine level", "urinary iodine", "serum iodine"]
  },
  "Omega-3 Index": {
    category: "nutrients",
    description: "Measures the percentage of EPA and DHA in red blood cell membranes.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["omega 3 index", "epa dha index", "omega-3 fatty acids"]
  },
  "Folate": {
    category: "nutrients",
    description: "B vitamin essential for cell division and DNA synthesis. Important during pregnancy for preventing neural tube defects.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["folic acid", "folacin", "vitamin b9", "serum folate"]
  },
  "Vitamin B6": {
    category: "nutrients",
    description: "Essential vitamin involved in brain development and function, as well as the production of hormones like serotonin and norepinephrine.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["b6", "pyridoxine", "vitamin b-6", "pyridoxal phosphate"]
  },
  "Vitamin C": {
    category: "nutrients",
    description: "Water-soluble vitamin important for immune function, collagen synthesis, and antioxidant protection.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["ascorbic acid", "vitamin c level", "ascorbate"]
  },
  "Vitamin E": {
    category: "nutrients",
    description: "Fat-soluble antioxidant that protects cells from damage caused by free radicals.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["tocopherol", "vitamin e level", "alpha-tocopherol"]
  },
  "Vitamin K": {
    category: "nutrients",
    description: "Fat-soluble vitamin essential for blood clotting and bone health.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["phylloquinone", "vitamin k1", "menaquinone", "vitamin k2"]
  },
  "Copper": {
    category: "nutrients",
    description: "Essential trace mineral important for iron metabolism, connective tissue formation, and neurotransmitter synthesis.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["cu", "copper level", "serum copper"]
  },

  // Electrolytes (Updated with alternate names)
  "Magnesium": {
    category: "electrolytes",
    description: "Important mineral involved in muscle and nerve function, blood glucose control, and bone development.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["mg", "magnesium level", "serum magnesium"]
  },
  "Bicarbonate": {
    category: "electrolytes",
    description: "Electrolyte that helps maintain acid-base balance in the body and transports carbon dioxide.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["hco3", "bicarb", "bicarbonate level", "co2"]
  },
  "Phosphate": {
    category: "electrolytes",
    description: "Electrolyte crucial for bone health, energy production, and cell structure and function.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["phosphorus", "po4", "serum phosphate", "inorganic phosphate"]
  },

  // Continue with existing categories but add missing ones from your list...

  // Pancreas (Updated with alternate names)
  "Amylase": {
    category: "pancreas",
    description: "Enzyme produced by the pancreas that helps digest carbohydrates. Elevated levels may indicate pancreatic disorders.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["amylase level", "serum amylase", "pancreatic amylase"]
  },
  "Lipase": {
    category: "pancreas",
    description: "Enzyme produced by the pancreas that helps digest fats. Elevated levels are often indicative of pancreatitis.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["lipase level", "serum lipase", "pancreatic lipase"]
  },

  // Iron (Updated with alternate names)
  "Iron": {
    category: "nutrients", // Changed from "iron" to "nutrients" for better organization
    description: "Measures the amount of iron in your blood.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["fe", "serum iron", "iron level"]
  },
  "Ferritin": {
    category: "nutrients",
    description: "A protein that stores iron in your body, also an inflammatory marker.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["ferritin level", "serum ferritin"]
  },
  "TIBC": {
    category: "nutrients",
    description: "Total iron-binding capacity, measures your body's ability to transport iron.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["total iron binding capacity", "tibc level"]
  },
  "TSAT": {
    category: "nutrients",
    description: "Transferrin saturation, indicates how much iron is bound to transferrin.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["transferrin saturation", "iron saturation", "tsat level"]
  },

  // Autoimmunity (Updated with alternate names)
  "Anti-TPO": {
    category: "autoimmunity",
    description: "Thyroid antibodies that can indicate autoimmune thyroid disease.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["thyroid peroxidase antibodies", "tpo antibodies", "anti-tpo antibodies"]
  },
  "Anti-TG": {
    category: "autoimmunity",
    description: "Antibodies against thyroglobulin that can indicate thyroid autoimmunity.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["thyroglobulin antibodies", "tg antibodies", "anti-thyroglobulin"]
  },
  "ANA": {
    category: "autoimmunity",
    description: "Antinuclear Antibodies, markers used to help identify autoimmune disorders like lupus or rheumatoid arthritis.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["antinuclear antibodies", "ana titer", "ana screen"]
  },
  "Rheumatoid Factor": {
    category: "autoimmunity",
    description: "Antibody often present in rheumatoid arthritis and some other autoimmune disorders.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["rf", "rheumatoid factor level", "ra factor"]
  },
  "Anti-CCP": {
    category: "autoimmunity",
    description: "Anti-cyclic Citrullinated Peptide antibodies, highly specific marker for rheumatoid arthritis.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["anti-ccp antibodies", "cyclic citrullinated peptide antibodies", "ccp antibodies"]
  },
  "ENA Panel": {
    category: "autoimmunity",
    description: "Extractable Nuclear Antigen panel, tests for specific antibodies associated with autoimmune disorders.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["extractable nuclear antigens", "ena antibodies", "ena screen"]
  },

  // Blood Count (Updated with alternate names - some were already added above)
  "WBC": {
    category: "blood",
    description: "White Blood Cell count measures the total number of white blood cells in your blood.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["white blood cell count", "white blood cells", "leukocyte count", "wbc count"]
  },
  "RBC": {
    category: "blood",
    description: "Red Blood Cell count measures the total number of red blood cells that carry oxygen through your blood.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["red blood cell count", "red blood cells", "erythrocyte count", "rbc count"]
  },
  "Hgb": {
    category: "blood",
    description: "Hemoglobin is the protein in red blood cells that carries oxygen to your body's organs and tissues.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["hemoglobin", "hb", "hemoglobin level"]
  },
  "MCV": {
    category: "blood",
    description: "Mean Corpuscular Volume measures the average size of your red blood cells.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["mean corpuscular volume", "mean cell volume"]
  },
  "MCH": {
    category: "blood",
    description: "Mean Corpuscular Hemoglobin measures the average amount of hemoglobin in each red blood cell.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["mean corpuscular hemoglobin", "mean cell hemoglobin"]
  },
  "MCHC": {
    category: "blood",
    description: "Mean Corpuscular Hemoglobin Concentration measures the average concentration of hemoglobin in your red blood cells.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["mean corpuscular hemoglobin concentration", "mean cell hemoglobin concentration"]
  },
  "RDW": {
    category: "blood",
    description: "Red Cell Distribution Width measures the range in size of your red blood cells.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["red cell distribution width", "red blood cell distribution width"]
  },
  "PLT": {
    category: "blood",
    description: "Platelet count measures the number of platelets in your blood, which are crucial for blood clotting.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["platelet count", "platelets", "thrombocyte count"]
  },
  "MPV": {
    category: "blood",
    description: "Mean Platelet Volume measures the average size of your platelets.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["mean platelet volume"]
  },
  "Neutrophils": {
    category: "blood",
    description: "A type of white blood cell that fights bacterial infections and is often the first line of defense when inflammation occurs.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["neutrophil count", "polys", "polymorphonuclear cells", "pmns"]
  },
  "Lymphocytes": {
    category: "blood",
    description: "White blood cells that fight viral infections and produce antibodies.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["lymphocyte count", "lymphs"]
  },
  "Monocytes": {
    category: "blood",
    description: "White blood cells that fight infection and help other white blood cells remove dead or damaged tissues.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["monocyte count", "monos"]
  },
  "Eosinophils": {
    category: "blood",
    description: "White blood cells that fight parasitic infections and are involved in allergic responses.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["eosinophil count", "eos"]
  },
  "Basophils": {
    category: "blood",
    description: "White blood cells involved in inflammatory reactions, particularly during allergic responses.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["basophil count", "basos"]
  },
  "Reticulocyte Count": {
    category: "blood",
    description: "Measures young red blood cells, indicating how quickly the bone marrow is making new RBCs. Used to evaluate anemia.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["reticulocytes", "retic count", "reticulocyte percentage"]
  },
  "Haptoglobin": {
    category: "blood",
    description: "Protein that binds free hemoglobin after red blood cell destruction. Low levels may indicate hemolytic anemia.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["haptoglobin level", "hp"]
  },
  "ESR": {
    category: "blood",
    description: "Erythrocyte Sedimentation Rate, non-specific indicator of inflammation used to monitor inflammatory diseases.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["erythrocyte sedimentation rate", "sed rate", "sedimentation rate"]
  },

  // Heavy Metals (Updated with alternate names)
  "Lead": {
    category: "metals",
    description: "Toxic heavy metal that can accumulate in the body and cause neurological damage, especially in children.",
    frequency: "annually",
    link: "",
    id: "",
    alternateNames: ["pb", "lead level", "blood lead"]
  },
  "Mercury": {
    category: "metals",
    description: "Toxic heavy metal that can cause neurological and kidney damage. Often found in certain fish and dental amalgams.",
    frequency: "annually",
    link: "",
    id: "",
    alternateNames: ["hg", "mercury level", "blood mercury"]
  },
  "Arsenic": {
    category: "metals",
    description: "Toxic metalloid that can cause skin lesions, cardiovascular disease, and increased cancer risk. Found in some foods, water sources, and industrial processes.",
    frequency: "annually",
    link: "",
    id: "",
    alternateNames: ["as", "arsenic level", "urine arsenic"]
  },
  "Cadmium": {
    category: "metals",
    description: "Toxic heavy metal that accumulates in the kidneys and can cause kidney damage and bone demineralization. Common sources include cigarette smoke.",
    frequency: "annually", 
    link: "",
    id: "",
    alternateNames: ["cd", "cadmium level", "blood cadmium"]
  },
  "Aluminum": {
    category: "metals",
    description: "Common metal that can accumulate in the body and may be associated with neurological disorders in high concentrations.",
    frequency: "annually",
    link: "",
    id: "",
    alternateNames: ["al", "aluminum level", "serum aluminum"]
  },

  // Bone Health (Updated with alternate names)
  "Alkaline Phosphatase (Bone-Specific)": {
    category: "bone",
    description: "Enzyme that indicates bone formation activity. Used to monitor bone diseases and treatment response.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["bone alkaline phosphatase", "bone alp", "bap"]
  },
  "Osteocalcin": {
    category: "bone",
    description: "Protein produced by osteoblasts during bone formation. Used as a marker of bone turnover.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["bone gla protein", "bgp", "osteocalcin level"]
  },
  "N-telopeptide": {
    category: "bone",
    description: "Marker of bone resorption. Elevated levels indicate increased bone breakdown.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["ntx", "n-terminal telopeptide", "bone resorption marker"]
  },
  "Parathyroid Hormone (PTH)": {
    category: "bone",
    description: "Hormone that regulates calcium and phosphate levels, affecting bone health. Imbalances can lead to bone disorders.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["pth", "parathyroid hormone", "intact pth"]
  },

  // Cancer Markers (Updated with alternate names)
  "PSA": {
    category: "cancer",
    description: "Prostate-Specific Antigen, used to screen for and monitor prostate cancer. Elevated levels may indicate prostate cancer or other prostate conditions.",
    frequency: "annually",
    link: "",
    id: "",
    alternateNames: ["prostate specific antigen", "psa level", "total psa"]
  },
  "CEA": {
    category: "cancer",
    description: "Carcinoembryonic Antigen, tumor marker primarily used for colorectal cancer monitoring. Also elevated in other cancers and some non-cancerous conditions.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["carcinoembryonic antigen", "cea level"]
  },
  "CA-125": {
    category: "cancer",
    description: "Cancer Antigen 125, primarily used to monitor ovarian cancer treatment. Can also be elevated in other cancers and some benign conditions.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["cancer antigen 125", "ca 125", "ca125"]
  },
  "AFP": {
    category: "cancer",
    description: "Alpha-Fetoprotein, marker used for liver cancer screening and monitoring. Also used to monitor testicular cancer and as part of prenatal screening.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["alpha fetoprotein", "alpha-fetoprotein", "afp level"]
  },
  "CA 19-9": {
    category: "cancer",
    description: "Cancer Antigen 19-9, primarily used as a marker for pancreatic cancer. Can also be elevated in other gastrointestinal cancers and some non-cancerous conditions.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["cancer antigen 19-9", "ca19-9", "ca 19.9"]
  },

  // Gut Health (Updated with alternate names)
  "Calprotectin": {
    category: "gut",
    description: "Protein released by neutrophils during intestinal inflammation. Used to differentiate between inflammatory bowel disease and irritable bowel syndrome.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["fecal calprotectin", "stool calprotectin"]
  },
  "Zonulin": {
    category: "gut",
    description: "Protein that regulates intestinal permeability. Elevated levels indicate increased intestinal permeability or 'leaky gut'.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["serum zonulin", "zonulin level"]
  },
  "Secretory IgA": {
    category: "gut",
    description: "Antibody that plays a critical role in mucosal immunity. Low levels may indicate compromised gut immune function.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["siga", "secretory iga", "salivary iga"]
  },
  "Short Chain Fatty Acids": {
    category: "gut",
    description: "Produced by gut bacteria during fermentation of fiber. Important for gut health and immune function.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
    alternateNames: ["scfa", "short-chain fatty acids", "butyrate", "acetate", "propionate"]
  }
};

// Helper function to get biomarkers that should be recommended when missing
function getRecommendableBiomarkers() {
  return Object.entries(biomarkerData)
    .filter(([key, data]) => data.recommendation)
    .reduce((acc, [key, data]) => {
      acc[key] = data;
      return acc;
    }, {});
}

module.exports = {
  biomarkerData,
  markerCategories,
  getRecommendableBiomarkers
};