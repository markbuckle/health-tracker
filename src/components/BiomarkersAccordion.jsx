import React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { Plus, Heart, Activity, Shield, Droplet, User, Users, TrendingUp, Apple, Pill, Circle, Flame, TestTube, Zap, Brain } from 'lucide-react';

const Accordion = AccordionPrimitive.Root;
const AccordionItem = AccordionPrimitive.Item;

const AccordionTrigger = React.forwardRef(({ className, children, isCategory, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={`flex flex-1 items-center justify-between py-6 px-8 font-medium transition-all text-left group ${
        isCategory ? '' : 'hover:bg-white/30'
      }`}
      {...props}
    >
      {children}
      <Plus className="h-6 w-6 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-45 text-gray-500" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));

const AccordionContent = React.forwardRef(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className="pb-2 pt-0 px-2">{children}</div>
  </AccordionPrimitive.Content>
));

// Icon mapping for each category
const categoryIcons = {
  cardiovascular: Heart,
  thyroid: Activity,
  'cancer-detection': Shield,
  autoimmunity: Shield,
  'immune-regulation': Shield,
  'female-health': User,
  'male-health': Users,
  metabolic: TrendingUp,
  nutrients: Apple,
  liver: Pill,
  iron: Circle,
  kidneys: Droplet,
  'heavy-metals': Flame,
  blood: Droplet,
  electrolytes: Zap,
  'brain-health': Brain
};

// Category icon component with unique icon per category
const CategoryIcon = ({ categoryId }) => {
  const Icon = categoryIcons[categoryId] || Activity;
  return (
    <div className="mr-5 flex-shrink-0 text-green-600 opacity-80">
      <Icon size={48} strokeWidth={1.5} />
    </div>
  );
};

// Biomarkers data organized by category
const categoriesData = [
  {
    id: 'cardiovascular',
    name: 'Cardiovascular',
    biomarkers: [
      {
        id: 'apob',
        name: 'Apolipoprotein B (ApoB)',
        description: 'The most accurate predictor of cardiovascular risk. ApoB counts the actual number of atherogenic particles that can penetrate artery walls, providing superior risk assessment compared to standard cholesterol panels.'
      },
      {
        id: 'lpa',
        name: 'Lipoprotein (a)',
        description: 'Genetic cardiovascular risk factor affecting 20% of the population. Elevated Lp(a) increases heart attack and stroke risk regardless of other cholesterol levels, making it crucial for personalized prevention.'
      },
      {
        id: 'apob-a1-ratio',
        name: 'Apolipoprotein B/A1 Ratio',
        description: 'Cutting-edge ratio that balances atherogenic vs. protective particles. Considered one of the strongest predictors of cardiovascular events, especially useful for personalized risk stratification.'
      },
      {
        id: 'ldl-particle',
        name: 'LDL Particle Number',
        description: 'Revolutionary test that counts actual LDL particles rather than just cholesterol content. More predictive of heart disease risk than traditional LDL cholesterol measurements.'
      },
      {
        id: 'ldl-small',
        name: 'LDL Small Particles',
        description: 'Small, dense LDL particles are significantly more atherogenic than large particles. This advanced test identifies patients at higher risk who may appear normal on standard cholesterol tests.'
      }
    ]
  },
  {
    id: 'thyroid',
    name: 'Thyroid',
    biomarkers: [
      {
        id: 'tsh',
        name: 'Thyroid Stimulating Hormone (TSH)',
        description: 'Primary screening test for thyroid function. TSH levels indicate whether the thyroid is producing adequate amounts of thyroid hormones, essential for metabolism regulation.'
      },
      {
        id: 'free-t3',
        name: 'Free T3',
        description: 'The active form of thyroid hormone that directly affects metabolism, energy levels, and body temperature. Often reveals thyroid dysfunction missed by TSH alone.'
      },
      {
        id: 'free-t4',
        name: 'Free T4',
        description: 'The storage form of thyroid hormone that converts to active T3. Critical for understanding thyroid hormone production and conversion efficiency.'
      },
      {
        id: 'thyroid-antibodies',
        name: 'Thyroid Antibodies (TPO/TG)',
        description: 'Detects autoimmune thyroid disease, the most common cause of hypothyroidism. Early detection enables preventive interventions before significant thyroid damage occurs.'
      }
    ]
  },
  {
    id: 'cancer-detection',
    name: 'Cancer Detection',
    biomarkers: [
      {
        id: 'multi-cancer',
        name: 'Multi-Cancer Detection Test',
        description: 'Revolutionary blood test detecting over 50 types of cancer, often before symptoms appear. Uses cell-free DNA analysis to identify cancer signals with high specificity.'
      },
      {
        id: 'psa-free',
        name: 'Prostate Specific Antigen (PSA), Free',
        description: 'Helps distinguish between benign prostate conditions and prostate cancer when PSA is elevated. Higher free PSA percentage suggests lower cancer risk.'
      },
      {
        id: 'psa-total',
        name: 'Prostate Specific Antigen (PSA), Total',
        description: 'Primary screening tool for prostate cancer in men. Regular monitoring enables early detection when treatment is most effective.'
      },
      {
        id: 'cea',
        name: 'Carcinoembryonic Antigen (CEA)',
        description: 'Tumor marker useful for monitoring colorectal, lung, and other cancers. Helps detect recurrence and assess treatment response.'
      }
    ]
  },
  {
    id: 'autoimmunity',
    name: 'Autoimmunity',
    biomarkers: [
      {
        id: 'ana',
        name: 'Antinuclear Antibodies (ANA)',
        description: 'Screening test for systemic autoimmune diseases including lupus, Sjögren\'s syndrome, and scleroderma. Positive results warrant further investigation.'
      },
      {
        id: 'rheumatoid-factor',
        name: 'Rheumatoid Factor (RF)',
        description: 'Key marker for rheumatoid arthritis and other autoimmune conditions. Early detection enables aggressive treatment to prevent joint damage.'
      },
      {
        id: 'celiac-antibodies',
        name: 'Celiac Disease Antibodies',
        description: 'Screens for celiac disease, an autoimmune reaction to gluten. Early diagnosis prevents malnutrition and reduces cancer risk.'
      }
    ]
  },
  {
    id: 'immune-regulation',
    name: 'Immune Regulation',
    biomarkers: [
      {
        id: 'oxidized-ldl',
        name: 'Oxidized LDL',
        description: 'Advanced marker of oxidative stress and vascular inflammation. Oxidized LDL is the actual culprit in atherosclerosis development, making it a powerful predictor of cardiovascular events.'
      },
      {
        id: 'hs-crp',
        name: 'High-Sensitivity C-Reactive Protein (hs-CRP)',
        description: 'Sensitive marker of systemic inflammation and cardiovascular risk. Elevated levels predict heart disease even when cholesterol is normal.'
      },
      {
        id: 'esr',
        name: 'Erythrocyte Sedimentation Rate (ESR)',
        description: 'Non-specific marker of inflammation useful for monitoring autoimmune diseases, infections, and inflammatory conditions.'
      }
    ]
  },
  {
    id: 'female-health',
    name: 'Female Health',
    biomarkers: [
      {
        id: 'estradiol',
        name: 'Estradiol',
        description: 'Primary female sex hormone essential for reproductive health, bone density, and cardiovascular protection. Monitoring is crucial during all life stages.'
      },
      {
        id: 'progesterone',
        name: 'Progesterone',
        description: 'Balances estrogen and is essential for menstrual cycle regulation and pregnancy maintenance. Deficiency causes numerous symptoms including mood changes.'
      },
      {
        id: 'fsh-lh',
        name: 'FSH and LH',
        description: 'Regulates ovarian function and fertility. Abnormal levels indicate ovarian dysfunction, PCOS, or menopause transition.'
      },
      {
        id: 'amh',
        name: 'Anti-Müllerian Hormone (AMH)',
        description: 'Indicates ovarian reserve and reproductive lifespan. Valuable for fertility planning and PCOS diagnosis.'
      }
    ]
  },
  {
    id: 'male-health',
    name: 'Male Health',
    biomarkers: [
      {
        id: 'total-testosterone',
        name: 'Total Testosterone',
        description: 'Essential hormone for male vitality, muscle mass, bone density, and sexual function. Declining levels affect multiple body systems.'
      },
      {
        id: 'free-testosterone',
        name: 'Free Testosterone',
        description: 'The biologically active form of testosterone. More accurate indicator of testosterone status than total testosterone alone.'
      },
      {
        id: 'shbg',
        name: 'Sex Hormone Binding Globulin (SHBG)',
        description: 'Binds sex hormones and affects their availability. High levels reduce free testosterone despite normal total levels.'
      },
      {
        id: 'dht',
        name: 'Dihydrotestosterone (DHT)',
        description: 'Most potent androgen affecting prostate health, hair growth, and male characteristics. Imbalances cause various health issues.'
      }
    ]
  },
  {
    id: 'metabolic',
    name: 'Metabolic',
    biomarkers: [
      {
        id: 'hba1c',
        name: 'Hemoglobin A1c (HbA1c)',
        description: 'Gold standard for assessing long-term blood sugar control. Reflects average glucose levels over 2-3 months, crucial for diabetes management and prevention.'
      },
      {
        id: 'fasting-insulin',
        name: 'Fasting Insulin',
        description: 'Early indicator of insulin resistance, often elevated years before blood sugar rises. Critical for diabetes prevention.'
      },
      {
        id: 'fasting-glucose',
        name: 'Fasting Glucose',
        description: 'Basic screening for diabetes and prediabetes. However, often becomes abnormal only after significant metabolic dysfunction.'
      },
      {
        id: 'triglycerides',
        name: 'Triglycerides',
        description: 'Reflects dietary sugar and alcohol intake. Elevated levels indicate increased cardiovascular and metabolic disease risk.'
      }
    ]
  },
  {
    id: 'nutrients',
    name: 'Nutrients',
    biomarkers: [
      {
        id: 'vitamin-d',
        name: 'Vitamin D, 25-Hydroxy',
        description: 'Critical hormone affecting immune function, bone health, mood, and chronic disease risk. Deficiency is extremely common and easily correctable.'
      },
      {
        id: 'vitamin-b12',
        name: 'Vitamin B12',
        description: 'Essential for nerve function, DNA synthesis, and red blood cell formation. Deficiency causes fatigue, neuropathy, and cognitive decline.'
      },
      {
        id: 'folate',
        name: 'Folate (Vitamin B9)',
        description: 'Critical for DNA synthesis, red blood cell production, and preventing neural tube defects. Especially important during pregnancy.'
      },
      {
        id: 'magnesium',
        name: 'Magnesium, RBC',
        description: 'RBC magnesium better reflects body stores than serum levels. Deficiency affects over 300 enzymatic reactions, causing widespread symptoms.'
      }
    ]
  },
  {
    id: 'liver',
    name: 'Liver',
    biomarkers: [
      {
        id: 'alt',
        name: 'ALT (Alanine Aminotransferase)',
        description: 'Most specific marker of liver cell damage. Elevated levels indicate liver inflammation from various causes including fatty liver disease.'
      },
      {
        id: 'ast',
        name: 'AST (Aspartate Aminotransferase)',
        description: 'Liver enzyme also found in heart and muscle. Elevated levels indicate liver or muscle damage requiring further investigation.'
      },
      {
        id: 'ggt',
        name: 'GGT (Gamma-Glutamyl Transferase)',
        description: 'Sensitive marker of liver disease and oxidative stress. Elevated levels predict cardiovascular disease and metabolic syndrome.'
      },
      {
        id: 'alkaline-phosphatase',
        name: 'Alkaline Phosphatase (ALP)',
        description: 'Found in liver and bone. Elevated levels indicate liver obstruction, bone disease, or vitamin D deficiency.'
      }
    ]
  },
  {
    id: 'iron',
    name: 'Iron',
    biomarkers: [
      {
        id: 'ferritin',
        name: 'Ferritin',
        description: 'Best indicator of iron stores. Low levels cause fatigue and weakness, while high levels indicate inflammation or iron overload.'
      },
      {
        id: 'serum-iron',
        name: 'Serum Iron',
        description: 'Measures circulating iron levels. Must be interpreted with TIBC and ferritin for accurate assessment.'
      },
      {
        id: 'tibc',
        name: 'Total Iron Binding Capacity (TIBC)',
        description: 'Reflects the blood\'s capacity to bind iron. Helps distinguish between different causes of anemia.'
      },
      {
        id: 'transferrin-saturation',
        name: 'Transferrin Saturation',
        description: 'Percentage of transferrin bound to iron. Low levels indicate iron deficiency, high levels suggest iron overload.'
      }
    ]
  },
  {
    id: 'kidneys',
    name: 'Kidneys',
    biomarkers: [
      {
        id: 'creatinine',
        name: 'Creatinine',
        description: 'Waste product filtered by kidneys. Elevated levels indicate reduced kidney function requiring further evaluation.'
      },
      {
        id: 'egfr',
        name: 'eGFR (Estimated Glomerular Filtration Rate)',
        description: 'Best overall indicator of kidney function. Calculates kidney filtering capacity using creatinine, age, sex, and race.'
      },
      {
        id: 'bun',
        name: 'Blood Urea Nitrogen (BUN)',
        description: 'Another waste product filtered by kidneys. Elevated levels suggest kidney dysfunction, dehydration, or high protein intake.'
      },
      {
        id: 'urine-albumin',
        name: 'Urine Albumin/Creatinine Ratio',
        description: 'Early marker of kidney damage, especially important for diabetics. Detects kidney disease before creatinine rises.'
      }
    ]
  },
  {
    id: 'heavy-metals',
    name: 'Heavy Metals',
    biomarkers: [
      {
        id: 'lead',
        name: 'Lead',
        description: 'Toxic heavy metal causing neurological damage, especially in children. Even low levels impair cognitive function and increase cardiovascular risk.'
      },
      {
        id: 'mercury',
        name: 'Mercury',
        description: 'Neurotoxin accumulating from fish consumption and dental amalgams. Causes neurological and kidney damage at elevated levels.'
      },
      {
        id: 'cadmium',
        name: 'Cadmium',
        description: 'Toxic metal from smoking and environmental exposure. Accumulates in kidneys causing damage and increasing cancer risk.'
      },
      {
        id: 'arsenic',
        name: 'Arsenic',
        description: 'Toxic metalloid found in contaminated water and food. Chronic exposure increases cancer risk and cardiovascular disease.'
      }
    ]
  },
  {
    id: 'blood',
    name: 'Blood',
    biomarkers: [
      {
        id: 'cbc',
        name: 'Complete Blood Count (CBC)',
        description: 'Comprehensive panel assessing red cells, white cells, and platelets. Screens for anemia, infection, immune disorders, and blood cancers.'
      },
      {
        id: 'hemoglobin',
        name: 'Hemoglobin',
        description: 'Oxygen-carrying protein in red blood cells. Low levels cause fatigue and indicate anemia requiring investigation.'
      },
      {
        id: 'hematocrit',
        name: 'Hematocrit',
        description: 'Percentage of blood volume occupied by red blood cells. Low levels indicate anemia, high levels suggest dehydration or polycythemia.'
      },
      {
        id: 'wbc',
        name: 'White Blood Cell Count',
        description: 'Measures immune system cells. Elevated or low counts indicate infection, immune disorders, or bone marrow problems.'
      }
    ]
  },
  {
    id: 'electrolytes',
    name: 'Electrolytes',
    biomarkers: [
      {
        id: 'sodium',
        name: 'Sodium',
        description: 'Principal electrolyte regulating fluid balance and nerve function. Imbalances cause serious neurological and cardiac complications.'
      },
      {
        id: 'potassium',
        name: 'Potassium',
        description: 'Critical for heart rhythm, muscle function, and nerve transmission. Both high and low levels are potentially life-threatening.'
      },
      {
        id: 'chloride',
        name: 'Chloride',
        description: 'Major electrolyte working with sodium to maintain fluid balance and acid-base status. Imbalances indicate metabolic problems.'
      },
      {
        id: 'co2',
        name: 'Carbon Dioxide (CO2)',
        description: 'Reflects acid-base balance and respiratory function. Abnormal levels indicate metabolic or respiratory disorders.'
      }
    ]
  },
  {
    id: 'brain-health',
    name: 'Brain Health',
    biomarkers: [
      {
        id: 'homocysteine',
        name: 'Homocysteine',
        description: 'Amino acid linked to cardiovascular disease, stroke, and Alzheimer\'s disease. Elevated levels cause vascular and brain damage.'
      },
      {
        id: 'omega-3-index',
        name: 'Omega-3 Index',
        description: 'Measures EPA and DHA levels in red blood cells. Low levels increase depression, cognitive decline, and cardiovascular disease risk.'
      },
      {
        id: 'vitamin-b6',
        name: 'Vitamin B6',
        description: 'Essential for neurotransmitter synthesis and brain function. Deficiency causes depression, confusion, and peripheral neuropathy.'
      },
      {
        id: 'cortisol',
        name: 'Cortisol',
        description: 'Stress hormone affecting mood, memory, and metabolism. Chronic elevation damages the hippocampus and impairs cognition.'
      }
    ]
  }
];

export default function BiomarkersAccordion() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      {/* Main Categories Accordion */}
      <Accordion type="multiple" className="space-y-5">
        {categoriesData.map((category) => (
          <AccordionItem 
            key={category.id} 
            value={category.id}
            className="rounded-xl bg-transparent backdrop-blur-sm"
          >
            <AccordionTrigger isCategory={true} style={{ fontSize: '1.6rem' }}>
              <div className="flex items-center w-full">
                <CategoryIcon categoryId={category.id} />
                <span className="font-normal text-gray-700" style={{ fontSize: '1.6rem' }}>{category.name}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {/* Nested Biomarkers Accordion */}
              <Accordion type="multiple" className="space-y-2">
                {category.biomarkers.map((biomarker) => (
                  <AccordionItem 
                    key={biomarker.id} 
                    value={biomarker.id}
                    className="border border-gray-200 rounded-md bg-white/40 backdrop-blur-sm ml-4 mr-2"
                  >
                    <AccordionTrigger isCategory={false} className="text-lg py-6 border-b border-gray-300">
                      <span className="text-gray-600 font-normal" style={{ fontSize: '1rem' }}>{biomarker.name}</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="text-gray-600 leading-relaxed px-8 pb-6 pt-6 text-base">
                        {biomarker.description}
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}