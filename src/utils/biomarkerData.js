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

const biomarkerData = {
  // Cardiovascular
  "Apo-B": {
    category: "cardiovascular",
    description: "Apolipoprotein B (Apo-B) is the main component of atherogenesis (plaque building). It represents the total atherogenic particles in circulation.",
    link: "https://www.thelancet.com/journals/lanhl/article/PIIS2666-7568(21)00120-3/fulltext",
    frequency: "quarterly/annually",
    id: "1",
  },
  "ApoA1": {
    category: "cardiovascular",
    description: "Apolipoprotein A1 is the main protein component of HDL cholesterol. Higher levels are associated with reduced cardiovascular risk.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Lp(a)": {
    category: "cardiovascular",
    description: "Lipoprotein(a) [Lp(a)] is an atherogenic lipoprotein with a strong genetic regulation.",
    link: "https://peterattiamd.com/high-lpa-risk-factors/",
    frequency: "one-time",
    id: "2",
  },
 "LDL-C": {
    category: "cardiovascular",
    description: "Low-density lipoprotein cholesterol (LDL-C) is often referred to as 'bad' cholesterol as it can build up in your arteries.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "HDL-C": {
    category: "cardiovascular", 
    description: "High-density lipoprotein cholesterol (HDL-C) is known as 'good' cholesterol as it helps remove other forms of cholesterol from your bloodstream.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Triglycerides": {
    category: "cardiovascular",
    description: "A type of fat in your blood that your body uses for energy.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Non-HDL-C": {
    category: "cardiovascular",
    description: "Represents all 'bad' cholesterol types combined.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "VLDL-C": {
    category: "cardiovascular",
    description: "Very low-density lipoprotein cholesterol, carries triglycerides through your blood.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Total Cholesterol": {
    category: "cardiovascular",
    description: "The total amount of cholesterol in your blood, including both LDL and HDL.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "TC/HDL-C": {
    category: "cardiovascular",
    description: "Ratio of total cholesterol to HDL, an important predictor of cardiovascular risk.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "LDL Particle Number": {
    category: "cardiovascular",
    description: "Count of LDL particles in blood. More predictive of cardiovascular risk than LDL-C concentration alone.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "LDL Particle Size": {
    category: "cardiovascular",
    description: "Measures the size of LDL particles. Small, dense LDL particles are associated with higher cardiovascular risk.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "HDL Particle Number": {
    category: "cardiovascular",
    description: "Count of HDL particles in blood. May provide additional insight into cardiovascular risk beyond HDL-C.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "oxLDL": {
    category: "cardiovascular",
    description: "Oxidized LDL, a marker of oxidative stress and inflammation associated with atherosclerosis.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "PCSK9": {
    category: "cardiovascular",
    description: "Proprotein convertase subtilisin/kexin type 9, regulates LDL receptor recycling and affects LDL levels.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },

  // Metabolic
  "HbA1C": {
    category: "metabolic",
    description: "Measures your average blood sugar levels over the past 2-3 months.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Fasting Blood Glucose": {
    category: "metabolic",
    description: "Blood sugar level when you haven't eaten for at least 8 hours.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Fasting Insulin": {
    category: "metabolic",
    description: "Measures insulin levels when you haven't eaten, helping assess insulin sensitivity.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "HOMA-IR": {
    category: "metabolic",
    description: "Homeostatic Model Assessment of Insulin Resistance, calculated from fasting glucose and insulin to assess insulin resistance.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Adiponectin": {
    category: "metabolic",
    description: "Hormone produced by fat cells that regulates glucose levels and fatty acid breakdown. Higher levels are associated with improved insulin sensitivity.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Leptin": {
    category: "metabolic",
    description: "Hormone produced by fat cells that helps regulate energy balance by inhibiting hunger. Resistance can lead to obesity.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "GGT/AST Ratio": {
    category: "metabolic",
    description: "Ratio of gamma-glutamyl transferase to aspartate aminotransferase, used as a marker for insulin resistance and fatty liver.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },

  // Immune/Inflammation
  "hsCRP": {
    category: "immunity",
    description: "High-sensitivity C-reactive protein, a marker of inflammation in your body.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Homocysteine": {
    category: "immunity",
    description: "An amino acid that, when elevated, may indicate increased risk of heart disease.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "C-Peptide": {
    category: "inflammation",
    description: "Indicates how much insulin your pancreas is producing.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "IL-6": {
    category: "immunity",
    description: "Interleukin-6, a pro-inflammatory cytokine involved in immune response and inflammation. Elevated in various inflammatory conditions.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "TNF-alpha": {
    category: "immunity",
    description: "Tumor Necrosis Factor alpha, a pro-inflammatory cytokine involved in systemic inflammation. Elevated in chronic inflammatory diseases.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Fibrinogen": {
    category: "immunity",
    description: "Protein produced by the liver that helps in blood clotting. Also an acute phase reactant that increases during inflammation.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Complement C3": {
    category: "immunity",
    description: "Protein involved in the complement system of immune response. Can indicate inflammation or autoimmune activity.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Complement C4": {
    category: "immunity",
    description: "Protein involved in the complement system of immune response. Low levels may indicate autoimmune disease.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },

  // Liver
  "ALT": {
    category: "liver",
    description: "Alanine aminotransferase (ALT) is an enzyme primarily found in liver cells. Elevated levels may indicate liver damage.",
    frequency: "quarterly/annually",
    link: "",
    id: "",
  },
  "AST": {
    category: "liver",
    description: "Aspartate aminotransferase (ALT) an enzyme that can indicate liver damage when elevated.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "ALP": {
    category: "liver",
    description: "Alkaline phosphatase, an enzyme found in liver and bones.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "GGT": {
    category: "liver",
    description: "Gamma-glutamyl transferase, an enzyme that can indicate liver disease or bile duct issues.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Bilirubin": {
    category: "liver",
    description: "A yellowish substance produced during red blood cell breakdown.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Creatine Kinase": {
    category: "liver",
    description: "An enzyme that can indicate muscle damage when elevated.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },

  // Additional Liver markers
  "Albumin/Globulin Ratio": {
    category: "liver",
    description: "Ratio of albumin to globulin proteins in blood, used to assess liver and kidney function. Changes in this ratio can indicate liver disease or inflammation.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Total Protein": {
    category: "liver",
    description: "Measures albumin and globulin proteins in blood, helping evaluate nutritional status and liver or kidney dysfunction.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Direct Bilirubin": {
    category: "liver",
    description: "Bilirubin that has been processed by the liver. Elevated levels may indicate liver or bile duct disorders.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Indirect Bilirubin": {
    category: "liver",
    description: "Bilirubin that hasn't been processed by the liver. Elevated levels may indicate red blood cell destruction.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },

// Kidney
"Creatinine": {
  category: "kidney",
  description: "A waste product filtered by your kidneys, used to assess kidney function.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Cystatin C": {
  category: "kidney",
  description: "A protein used to estimate kidney function, in many cases more accurate than creatinine.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"eGFR": {
  category: "kidney",
  description: "Estimated glomerular filtration rate, measures how well your kidneys are filtering.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Albumin": {
  category: "kidney",
  description: "A protein made by your liver, low levels can indicate liver or kidney issues.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Microalbumin": {
  category: "kidney",
  description: "Small amounts of protein in urine that can indicate early kidney damage.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"BUN": {
  category: "kidney",
  description: "Blood urea nitrogen, a waste product filtered by your kidneys.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"BUN/Creatinine Ratio": {
  category: "kidney",
  description: "Ratio of blood urea nitrogen to creatinine, used to differentiate between kidney and non-kidney causes of abnormal values.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Uric Acid": {
  category: "kidney",
  description: "End product of purine metabolism. High levels can lead to gout and may indicate kidney dysfunction.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Urine pH": {
  category: "kidney",
  description: "Acidity level of urine, can indicate kidney function, metabolic conditions, or urinary tract infections.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},

// Pancreas
"Amylase": {
  category: "pancreas",
  description: "Enzyme produced by the pancreas that helps digest carbohydrates. Elevated levels may indicate pancreatic disorders.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Lipase": {
  category: "pancreas",
  description: "Enzyme produced by the pancreas that helps digest fats. Elevated levels are often indicative of pancreatitis.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},

// Iron
"Iron": {
  category: "iron",
  description: "Measures the amount of iron in your blood.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Ferritin": {
  category: "iron",
  description: "A protein that stores iron in your body, also an inflammatory marker.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"TIBC": {
  category: "iron",
  description: "Total iron-binding capacity, measures your body's ability to transport iron.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"TSAT": {
  category: "iron",
  description: "Transferrin saturation, indicates how much iron is bound to transferrin.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},

// Hormones
"Testosterone": {
    category: "hormones",
    description: "Testosterone is a critical hormone that plays key roles in both male and female health, including muscle mass, bone density, libido, and overall well-being.",
    link: "https://peterattiamd.com/preview-ama-28-all-things-testosterone-and-testosterone-replacement-therapy/",
    id: "3",
    frequency: "quarterly/annually"
},
"Free Testosterone": {
  category: "hormones",
  description: "The biologically active form of testosterone that's available for your body to use.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"SHBG": {
  category: "hormones",
  description: "Sex hormone binding globulin, controls the amount of testosterone that your tissues can use.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"DHEA-S": {
  category: "hormones",
  description: "A hormone that can be converted into testosterone and estrogen.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"TSH": {
  category: "hormones",
  description: "Thyroid stimulating hormone, controls your thyroid gland's function.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Free T3": {
  category: "hormones",
  description: "The active form of thyroid hormone.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Free T4": {
  category: "hormones",
  description: "The storage form of thyroid hormone.",
  frequency: "quarterly/annually",
  link: "",
  id: "",
  alternateNames: ["T4 Free", "FT4", "Free T4", "Free Thyroxine", "T4F"]
},
"Estradiol": {
  category: "hormones",
  description: "The main form of estrogen, important for reproductive and bone health.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Prolactin": {
  category: "hormones",
  description: "Hormone that stimulates breast milk production and influences reproductive function.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Reverse T3": {
  category: "hormones",
  description: "Inactive form of thyroid hormone that can block thyroid function when elevated.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"FSH": {
  category: "hormones",
  description: "Follicle-stimulating hormone, regulates reproductive processes including development, growth, and reproductive functions.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"LH": {
  category: "hormones",
  description: "Luteinizing hormone, stimulates ovulation in women and testosterone production in men.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Progesterone": {
  category: "hormones",
  description: "Hormone important for menstrual cycle and pregnancy maintenance in women.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Cortisol": {
  category: "hormones",
  description: "Primary stress hormone that affects metabolism, immune response, and inflammation.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Growth Hormone": {
  category: "hormones",
  description: "Hormone that stimulates growth, cell reproduction, and regeneration.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Insulin-like Growth Factor (IGF-1)": {
  category: "hormones",
  description: "Hormone similar to insulin that plays a key role in growth and has anabolic effects in adults.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},

// Nutrients
"Zinc": {
  category: "nutrients",
  description: "Trace mineral important for immune function, wound healing, and protein synthesis.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Selenium": {
  category: "nutrients",
  description: "Trace element important for thyroid function and antioxidant defense.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"CoEnzyme Q10": {
  category: "nutrients",
  description: "Antioxidant that helps generate energy in cells, particularly important for heart health.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Vitamin D": {
  category: "nutrients",
  description: "Fat-soluble vitamin crucial for bone health, immune function, and overall health.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Vitamin B12": {
  category: "nutrients",
  description: "Essential vitamin for nerve function and red blood cell formation.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Vitamin A": {
  category: "nutrients",
  description: "Fat-soluble vitamin important for vision, immune function, and cell growth.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Iodine": {
  category: "nutrients",
  description: "Mineral essential for thyroid hormone production.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Omega-3 Index": {
  category: "nutrients",
  description: "Measures the percentage of EPA and DHA in red blood cell membranes.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Folate": {
  category: "nutrients",
  description: "B vitamin essential for cell division and DNA synthesis. Important during pregnancy for preventing neural tube defects.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Vitamin B6": {
  category: "nutrients",
  description: "Essential vitamin involved in brain development and function, as well as the production of hormones like serotonin and norepinephrine.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Vitamin C": {
  category: "nutrients",
  description: "Water-soluble vitamin important for immune function, collagen synthesis, and antioxidant protection.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Vitamin E": {
  category: "nutrients",
  description: "Fat-soluble antioxidant that protects cells from damage caused by free radicals.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Vitamin K": {
  category: "nutrients",
  description: "Fat-soluble vitamin essential for blood clotting and bone health.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Copper": {
  category: "nutrients",
  description: "Essential trace mineral important for iron metabolism, connective tissue formation, and neurotransmitter synthesis.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},

 // Electrolytes
 "Sodium": {
  category: "electrolytes",
  description: "Essential electrolyte that helps maintain blood pressure and proper nerve and muscle function.",
  frequency: "quarterly/annually",
  link: "",
  id: "",
},
"Potassium": {
  category: "electrolytes",
  description: "Essential electrolyte for heart function and muscle contraction.",
  frequency: "quarterly/annually",
  link: "",
  id: "",
},
"Magnesium": {
  category: "electrolytes",
  description: "Important mineral involved in muscle and nerve function, blood glucose control, and bone development.",
  frequency: "quarterly/annually",
  link: "",
  id: "",
},
"Calcium": {
  category: "electrolytes",
  description: "Mineral essential for bone health, muscle function, and blood clotting.",
  frequency: "quarterly/annually",
  link: "",
  id: "",
},
"Chloride": {
  category: "electrolytes",
  description: "Electrolyte that helps maintain proper fluid balance, pH, and blood pressure.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Bicarbonate": {
  category: "electrolytes",
  description: "Electrolyte that helps maintain acid-base balance in the body and transports carbon dioxide.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Phosphate": {
  category: "electrolytes",
  description: "Electrolyte crucial for bone health, energy production, and cell structure and function.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},

  // Autoimmunity
  "Anti-TPO": {
    category: "autoimmunity",
    description: "Thyroid antibodies that can indicate autoimmune thyroid disease.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Anti-TG": {
    category: "autoimmunity",
    description: "Antibodies against thyroglobulin that can indicate thyroid autoimmunity.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "ANA": {
    category: "autoimmunity",
    description: "Antinuclear Antibodies, markers used to help identify autoimmune disorders like lupus or rheumatoid arthritis.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Rheumatoid Factor": {
    category: "autoimmunity",
    description: "Antibody often present in rheumatoid arthritis and some other autoimmune disorders.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Anti-CCP": {
    category: "autoimmunity",
    description: "Anti-cyclic Citrullinated Peptide antibodies, highly specific marker for rheumatoid arthritis.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "ENA Panel": {
    category: "autoimmunity",
    description: "Extractable Nuclear Antigen panel, tests for specific antibodies associated with autoimmune disorders.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },

  // Blood Count
  "WBC": {
    category: "blood",
    description: "White Blood Cell count measures the total number of white blood cells in your blood.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "RBC": {
    category: "blood",
    description: "Red Blood Cell count measures the total number of red blood cells that carry oxygen through your blood.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Hgb": {
    category: "blood",
    description: "Hemoglobin is the protein in red blood cells that carries oxygen to your body's organs and tissues.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "MCV": {
    category: "blood",
    description: "Mean Corpuscular Volume measures the average size of your red blood cells.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "MCH": {
    category: "blood",
    description: "Mean Corpuscular Hemoglobin measures the average amount of hemoglobin in each red blood cell.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "MCHC": {
    category: "blood",
    description: "Mean Corpuscular Hemoglobin Concentration measures the average concentration of hemoglobin in your red blood cells.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "RDW": {
    category: "blood",
    description: "Red Cell Distribution Width measures the range in size of your red blood cells.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "PLT": {
    category: "blood",
    description: "Platelet count measures the number of platelets in your blood, which are crucial for blood clotting.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "MPV": {
    category: "blood",
    description: "Mean Platelet Volume measures the average size of your platelets.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Neutrophils": {
    category: "blood",
    description: "A type of white blood cell that fights bacterial infections and is often the first line of defense when inflammation occurs.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Lymphocytes": {
    category: "blood",
    description: "White blood cells that fight viral infections and produce antibodies.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Monocytes": {
    category: "blood",
    description: "White blood cells that fight infection and help other white blood cells remove dead or damaged tissues.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Eosinophils": {
    category: "blood",
    description: "White blood cells that fight parasitic infections and are involved in allergic responses.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Basophils": {
    category: "blood",
    description: "White blood cells involved in inflammatory reactions, particularly during allergic responses.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Reticulocyte Count": {
    category: "blood",
    description: "Measures young red blood cells, indicating how quickly the bone marrow is making new RBCs. Used to evaluate anemia.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Haptoglobin": {
    category: "blood",
    description: "Protein that binds free hemoglobin after red blood cell destruction. Low levels may indicate hemolytic anemia.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "ESR": {
    category: "blood",
    description: "Erythrocyte Sedimentation Rate, non-specific indicator of inflammation used to monitor inflammatory diseases.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Hematocrit": {
    category: "blood",
    description: "Percentage of blood volume that is occupied by red blood cells. Used to diagnose anemia and polycythemia.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },

  // Heavy Metals
  "Lead": {
    category: "metals",
    description: "Toxic heavy metal that can accumulate in the body and cause neurological damage, especially in children.",
    frequency: "annually",
    link: "",
    id: ""
  },
  "Mercury": {
    category: "metals",
    description: "Toxic heavy metal that can cause neurological and kidney damage. Often found in certain fish and dental amalgams.",
    frequency: "annually",
    link: "",
    id: ""
  },
  "Arsenic": {
    category: "metals",
    description: "Toxic metalloid that can cause skin lesions, cardiovascular disease, and increased cancer risk. Found in some foods, water sources, and industrial processes.",
    frequency: "annually",
    link: "",
    id: ""
  },
  "Cadmium": {
    category: "metals",
    description: "Toxic heavy metal that accumulates in the kidneys and can cause kidney damage and bone demineralization. Common sources include cigarette smoke.",
    frequency: "annually", 
    link: "",
    id: ""
  },
  "Aluminum": {
    category: "metals",
    description: "Common metal that can accumulate in the body and may be associated with neurological disorders in high concentrations.",
    frequency: "annually",
    link: "",
    id: ""
  },

  // Bone Health
  "Alkaline Phosphatase (Bone-Specific)": {
    category: "bone",
    description: "Enzyme that indicates bone formation activity. Used to monitor bone diseases and treatment response.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Osteocalcin": {
    category: "bone",
    description: "Protein produced by osteoblasts during bone formation. Used as a marker of bone turnover.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "N-telopeptide": {
    category: "bone",
    description: "Marker of bone resorption. Elevated levels indicate increased bone breakdown.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Parathyroid Hormone (PTH)": {
    category: "bone",
    description: "Hormone that regulates calcium and phosphate levels, affecting bone health. Imbalances can lead to bone disorders.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },

  // Cancer Markers
  "PSA": {
    category: "cancer",
    description: "Prostate-Specific Antigen, used to screen for and monitor prostate cancer. Elevated levels may indicate prostate cancer or other prostate conditions.",
    frequency: "annually",
    link: "",
    id: ""
  },
  "CEA": {
    category: "cancer",
    description: "Carcinoembryonic Antigen, tumor marker primarily used for colorectal cancer monitoring. Also elevated in other cancers and some non-cancerous conditions.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "CA-125": {
    category: "cancer",
    description: "Cancer Antigen 125, primarily used to monitor ovarian cancer treatment. Can also be elevated in other cancers and some benign conditions.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "AFP": {
    category: "cancer",
    description: "Alpha-Fetoprotein, marker used for liver cancer screening and monitoring. Also used to monitor testicular cancer and as part of prenatal screening.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "CA 19-9": {
    category: "cancer",
    description: "Cancer Antigen 19-9, primarily used as a marker for pancreatic cancer. Can also be elevated in other gastrointestinal cancers and some non-cancerous conditions.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },

  // Gut Health
  "Calprotectin": {
    category: "gut",
    description: "Protein released by neutrophils during intestinal inflammation. Used to differentiate between inflammatory bowel disease and irritable bowel syndrome.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Zonulin": {
    category: "gut",
    description: "Protein that regulates intestinal permeability. Elevated levels indicate increased intestinal permeability or 'leaky gut'.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Secretory IgA": {
    category: "gut",
    description: "Antibody that plays a critical role in mucosal immunity. Low levels may indicate compromised gut immune function.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  },
  "Short Chain Fatty Acids": {
    category: "gut",
    description: "Produced by gut bacteria during fermentation of fiber. Important for gut health and immune function.",
    frequency: "quarterly/annually",
    link: "",
    id: ""
  }
  // Add more biomarkers with their categories...
};

module.exports = {
  biomarkerData,
  markerCategories
};