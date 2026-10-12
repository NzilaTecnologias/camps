import { Field, SelectField } from "./field";

type Props = { providers: { id: string; label: string }[] };

export function PaymentFields({ providers }: Props) {
  if (providers.length === 0) {
    return <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">Nenhum método de pagamento está configurado nesta plataforma.</p>;
  }
  const hasMulticaixa = providers.some((provider) => provider.id === "MULTICAIXA_EXPRESS");
  return (
    <>
      <SelectField label="Método de pagamento" name="provider" required>
        {providers.map((provider) => (
          <option key={provider.id} value={provider.id}>
            {provider.label}
          </option>
        ))}
      </SelectField>
      {hasMulticaixa && (
        <Field
          label="Telemóvel associado ao Multicaixa Express"
          name="mobile"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="923 456 789"
        />
      )}
    </>
  );
}
