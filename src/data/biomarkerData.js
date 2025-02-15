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
  Immunity: {
    name: "Immunity",
    description: "Markers related to inflammation and immune system regulation"
  },
  Autoimmunity: {
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
  heavyMetals: {
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
// Immune/Inflammation
"hsCRP": {
  category: "Immunity",
  description: "High-sensitivity C-reactive protein, a marker of inflammation in your body.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Homocysteine": {
  category: "Immunity",
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

// Liver
"ALT": {
  category: "Liver",
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
    category: "Hormones",
    description: "Testosterone is a critical hormone that plays key roles in both male and female health, including muscle mass, bone density, libido, and overall well-being.",
    link: "https://peterattiamd.com/preview-ama-28-all-things-testosterone-and-testosterone-replacement-therapy/",
    id: "3",
    frequency: "quarterly/annually"
},
"Free Testosterone": {
  category: "Hormones",
  description: "The biologically active form of testosterone that's available for your body to use.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"SHBG": {
  category: "Hormones",
  description: "Sex hormone binding globulin, controls the amount of testosterone that your tissues can use.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"DHEA-S": {
  category: "Hormones",
  description: "A hormone that can be converted into testosterone and estrogen.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"TSH": {
  category: "Hormones",
  description: "Thyroid stimulating hormone, controls your thyroid gland's function.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Free T3": {
  category: "Hormones",
  description: "The active form of thyroid hormone.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Free T4": {
  category: "Hormones",
  description: "The storage form of thyroid hormone.",
  frequency: "quarterly/annually",
  link: "",
  id: "",
  alternateNames: ["T4 Free", "FT4", "Free T4", "Free Thyroxine", "T4F"]
},
"Estradiol": {
  category: "Hormones",
  description: "The main form of estrogen, important for reproductive and bone health.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Prolactin": {
  category: "Hormones",
  description: "Hormone that stimulates breast milk production and influences reproductive function.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Reverse T3": {
  category: "Hormones",
  description: "Inactive form of thyroid hormone that can block thyroid function when elevated.",
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

 // Electrolytes
 "Sodium": {
  category: "Electrolytes",
  description: "Essential electrolyte that helps maintain blood pressure and proper nerve and muscle function.",
  frequency: "quarterly/annually",
  link: "",
  id: "",
},
"Potassium": {
  category: "Electrolytes",
  description: "Essential electrolyte for heart function and muscle contraction.",
  frequency: "quarterly/annually",
  link: "",
  id: "",
},
"Magnesium": {
  category: "Electrolytes",
  description: "Important mineral involved in muscle and nerve function, blood glucose control, and bone development.",
  frequency: "quarterly/annually",
  link: "",
  id: "",
},
"Calcium": {
  category: "Electrolytes",
  description: "Mineral essential for bone health, muscle function, and blood clotting.",
  frequency: "quarterly/annually",
  link: "",
  id: "",
},
// Autoimmunity
"Anti-TPO": {
  category: "Autoimmunity",
  description: "Thyroid antibodies that can indicate autoimmune thyroid disease.",
  frequency: "quarterly/annually",
  link: "",
  id: ""
},
"Anti-TG": {
  category: "Autoimmunity",
  description: "Antibodies against thyroglobulin that can indicate thyroid autoimmunity.",
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
}
  // Add more biomarkers with their categories...
};

module.exports = {
  biomarkerData,
  markerCategories
};