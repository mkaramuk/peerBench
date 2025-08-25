import BellCurveApexChart from "./LLMChart";

export default function Page() {
  return (
    <div className="p-6 space-y-12">
      <h1 className="text-2xl font-bold">Gaussian Dağılım Görselleştirme</h1>

      <section>
        <h2 className="text-lg font-semibold mb-2">ApexCharts ile</h2>
        <BellCurveApexChart />
      </section>
    </div>
  );
}
