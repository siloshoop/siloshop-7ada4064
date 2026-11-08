/** Splits a combined multi-currency label ("1,000 ل.س · $20.00") into one line per currency. */
export const amountParts = (value: string | number): string[] =>
  String(value).split(" · ").map((part) => part.trim()).filter(Boolean);

/** Amount labels too long for a half-width phone card. */
export const isWideAmount = (value: string | number): boolean => String(value).length > 12;

const StackedAmount = ({ value }: { value: string | number }) => (
  <>
    {amountParts(value).map((part, index) => (
      <span key={index} className="block break-words">
        {part}
      </span>
    ))}
  </>
);

export default StackedAmount;
