"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";

const ApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

// Gaussian dağılım fonksiyonu
function gaussian(x: number, mu: number, sigma: number): number {
  return (
    (1 / (sigma * Math.sqrt(2 * Math.PI))) *
    Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2))
  );
}

const BellCurveApexChart = () => {
  const mu = 0;
  const sigma = 1;

  const xValues = Array.from({ length: 200 }, (_, i) => -4 + (i * 8) / 199);
  const seriesData = xValues.map((x) => ({
    x: x.toFixed(2),
    y: gaussian(x, mu, sigma),
  }));

  const series = [
    {
      name: "Normal Dağılım",
      data: seriesData,
    },
  ];

  const options: ApexOptions = {
    chart: {
      type: "area",
      height: 400,
      toolbar: { show: false },
    },
    stroke: {
      curve: "smooth",
      width: 2,
      colors: ["#007bff"], // Sabit çizgi rengi (mavi)
    },
    fill: {
      type: "solid",
      colors: ["#007bff"], // Sabit alan rengi (mavi)
      opacity: 0.4,
    },
    xaxis: {
      type: "numeric",
      title: { text: "x (Standart Sapma Birimi)" },
      tickAmount: 10,
    },
    yaxis: {
      title: { text: "Yoğunluk" },
      min: 0,
    },
    markers: {
      size: 0, // Nokta işaretçileri kapalı
    },
    dataLabels: {
      enabled: false, // Nokta üstü etiketler devre dışı
    },
    tooltip: {
      enabled: false, // Hover baloncukları kapalı
    },
    legend: {
      show: false, // Legend istenirse açılabilir
    },
    title: {
      text: "Normal Dağılım Eğrisi (μ=0, σ=1)",
      align: "left",
    },
  };

  return (
    <ApexChart options={options} series={series} type="area" height={400} />
  );
};

export default BellCurveApexChart;
