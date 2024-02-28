import { useRef, useCallback } from "react";
import html2canvas from "html2canvas";

import Converter from "./converter";
import { Options, TargetElementFinder, UsePDFResult } from "./types";
import { buildConvertOptions } from "./utils";
import jsPDF from "jspdf";
export { Resolution, Margin } from "./constants";
export type { Options };

const getTargetElement = (
  targetRefOrFunction: TargetElementFinder
): HTMLElement | null | undefined => {
  if (typeof targetRefOrFunction === "function") {
    return targetRefOrFunction();
  }
  return targetRefOrFunction?.current;
};

export const usePDF = (usePDFoptions?: Options): UsePDFResult => {
  const targetRef = useRef();
  const toPDF = useCallback(
    (toPDFoptions?: Options): Promise<InstanceType<typeof jsPDF>> => {
      return generatePDF(targetRef, usePDFoptions ?? toPDFoptions);
    },
    [targetRef, usePDFoptions]
  );
  return { targetRef, toPDF };
};

const generatePDF = async (
  targetRefOrFunction: TargetElementFinder,
  customOptions?: Options
): Promise<InstanceType<typeof jsPDF>> => {
  const options = buildConvertOptions(customOptions);
  const targetElement = getTargetElement(targetRefOrFunction);
  if (!targetElement) {
    console.error("Unable to get the target element.");
    return;
  }

  const childNodes = Array.from(targetElement.children);
  const pages = [];

  // Ensure content within child elements is loaded and rendered before capturing
  await new Promise((resolve) => {
    setTimeout(resolve, 0); // Schedule a microtask to allow for asynchronous loading
  });

  for (const child of childNodes) {
    if (child instanceof HTMLElement || child instanceof Text) {
      // Process both HTML elements and text nodes
      const canvas = await html2canvas(child as HTMLElement, {
        useCORS: options.canvas.useCORS,
        logging: options.canvas.logging,
        scale: options.resolution,
        ...options.overrides?.canvas,
      });

      if (canvas) { // Check if canvas is successfully created
        const converter = new Converter(canvas, options);
        const pdfPage = converter.convert();
        console.log("Captured PDF page data:", pdfPage);
        pages.push(pdfPage);
      } else {
        console.warn(`Failed to capture content for element: `, child);
      }
    } else {
      console.warn(`Ignoring unsupported child node type: `, child?.constructor.name);
    }
  }

  const pdf = new jsPDF();
  const a4WidthInInches = 8.27;
  const a4HeightInInches = 11.69;
  const resolution = 72; // 72 pixels per inch
  const widthInPixels = a4WidthInInches * resolution;
  const heightInPixels = a4HeightInInches * resolution;

  for (const page of pages) {
    const imageData = page.output('datauristring');
    const imageDataParts = imageData.split(",");
    const base64ImageData = imageDataParts[1];
  console.log("Image data to be added to PDF:", {base64ImageData}); 
    pdf.addPage()
    pdf.addImage(base64ImageData,'jpeg', 0, 0, 180, 180);
  }

  
  switch (options.method) {
    case "build":
      return pdf;
    case "open": {
      window.open(pdf.output("bloburl"), "_blank");
      return pdf;
    }
    case "save":
    default: {
      const pdfFilename = options.filename ?? `${new Date().getTime()}.pdf`;
      await pdf.save(pdfFilename, { returnPromise: true });
      return pdf;
    }
  }
};

export default generatePDF;
