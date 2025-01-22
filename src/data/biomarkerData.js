module.exports = {
    biomarkerData: {
      Testosterone: {
        description: "Testosterone is a critical hormone that plays key roles in both male and female health, including muscle mass, bone density, libido, and overall well-being.",
        unit: "nmol/L",
        referenceRanges: {
          optimal: "1.7-3.5",
          normal: "3.6-13.5",
          high: ">13.6"
        }
      },
      "Apo-B": {
        description: "In recent years the importance the role of apolipoprotein B (Apo-B) plays in major vascular diseases has become increasingly clear. ApoB is the main component of atherogenesis (plaque building). ApoB represents a direct measure of the total atherogenic particles (the sum of LDL, IDL, VLDL, and Lpa) in the circulation that can enter the arterial wall.",
        unit: "g/L",
        referenceRanges: {
          optimal: "0-0.8",
          normal: "0.81-1.05",
          high: ">1.05"
        }
      }
    }
  };