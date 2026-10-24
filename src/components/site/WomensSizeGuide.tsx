import { WOMENS_SIZE_GUIDE, WOMENS_SIZE_SOURCE } from "@/lib/womens-size-guide";

export function WomensSizeGuide({ customChart }: { customChart?: string | null }) {
  return (
    <details className="mt-5 border-t border-border pt-4">
      <summary className="cursor-pointer text-sm font-medium">Women’s size chart</summary>
      {customChart ? (
        <div className="mt-4">
          <p className="text-sm font-medium">Product-specific size chart</p>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{customChart}</p>
        </div>
      ) : null}
      <div className="mt-4">
        <p className="text-sm font-medium">General body measurements · inches</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <caption className="sr-only">Women’s general body measurements in inches, sourced from BIBA</caption>
            <thead className="bg-secondary text-secondary-foreground">
              <tr>{["Size", "Bust", "Waist", "Hips"].map((label) => <th key={label} scope="col" className="px-2 py-2 font-medium">{label}</th>)}</tr>
            </thead>
            <tbody>{WOMENS_SIZE_GUIDE.map((row) => (
              <tr key={row.size} className="border-b border-border">
                <th scope="row" className="whitespace-nowrap px-2 py-2 font-medium">{row.size}</th>
                <td className="whitespace-nowrap px-2 py-2">{row.bust}</td>
                <td className="whitespace-nowrap px-2 py-2">{row.waist}</td>
                <td className="whitespace-nowrap px-2 py-2">{row.hips}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Measure around the fullest part of your bust and hips, and your natural waist. These are general reference measurements, not verified AURALUXE garment measurements. Fit varies by brand and style; use the product-specific chart when available. For 3XL–10XL or an exact fit, confirm measurements with us before ordering.</p>
        <a href={WOMENS_SIZE_SOURCE} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-primary underline">Source: BIBA women’s body-size guide</a>
      </div>
    </details>
  );
}