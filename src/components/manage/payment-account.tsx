import type { AccountView } from "@/server/payment-accounts";
import {
  removePaymentMethodAction,
  savePayPalAction,
  saveProxyPayAction,
  type OwnerKind,
} from "@/app/(main)/(site)/manage/payment-actions";
import { ActionForm } from "../action-form";
import { Field, SelectField } from "../field";
import { Badge, Card } from "../ui";

function Sandbox({ checked }: { checked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name="sandbox" defaultChecked={checked} className="h-4 w-4 accent-primary" />
      Conta de testes (sandbox): não cobra dinheiro a sério
    </label>
  );
}

function Status({ configured, sandbox }: { configured: boolean; sandbox: boolean }) {
  if (!configured) return <Badge>Por ligar</Badge>;
  return <Badge tone={sandbox ? "warning" : "success"}>{sandbox ? "Ligado (testes)" : "Ligado"}</Badge>;
}

/**
 * As credenciais ProxyPay (Multicaixa Express) e PayPal de uma organização ou federação. O dinheiro
 * dos atletas cai direto nessas contas; os segredos guardam-se cifrados e nunca voltam ao ecrã.
 */
export function PaymentAccountForms({ kind, id, account }: { kind: OwnerKind; id: string; account: AccountView }) {
  const { proxypay, paypal } = account;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Card className="p-5">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h3 className="font-display text-xl font-bold uppercase leading-none">Multicaixa Express</h3>
          <Status configured={proxypay.configured} sandbox={proxypay.sandbox} />
        </div>
        <p className="mb-4 text-sm text-muted">
          Através da ProxyPay. Peça a conta em proxypay.co.ao: o token da API e o número do ponto de venda (POS) estão no
          painel da ProxyPay.
        </p>
        <ActionForm
          action={saveProxyPayAction.bind(null, kind, id)}
          submitLabel={proxypay.configured ? "Atualizar" : "Ligar Multicaixa Express"}
          className="flex flex-col gap-4"
        >
          <Field
            label={proxypay.configured ? "Token da API (em branco mantém o atual)" : "Token da API"}
            name="token"
            type="password"
            autoComplete="off"
            required={!proxypay.configured}
          />
          <Field label="Número do POS" name="posId" inputMode="numeric" defaultValue={proxypay.posId ?? ""} required />
          <Sandbox checked={proxypay.sandbox} />
        </ActionForm>
        {proxypay.configured && (
          <div className="mt-4 border-t border-line pt-4">
            <ActionForm action={removePaymentMethodAction.bind(null, kind, id, "MULTICAIXA_EXPRESS")} submitLabel="Desligar" submitVariant="secondary">
              {null}
            </ActionForm>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h3 className="font-display text-xl font-bold uppercase leading-none">PayPal</h3>
          <Status configured={paypal.configured} sandbox={paypal.sandbox} />
        </div>
        <p className="mb-4 text-sm text-muted">
          Para atletas com cartão internacional. Crie uma app em developer.paypal.com (My Apps &amp; Credentials). O PayPal não
          cobra em kwanzas: indique a moeda da conta e o câmbio a usar.
        </p>
        <ActionForm
          action={savePayPalAction.bind(null, kind, id)}
          submitLabel={paypal.configured ? "Atualizar" : "Ligar PayPal"}
          className="flex flex-col gap-4"
        >
          <Field label="Client ID" name="clientId" defaultValue={paypal.clientId ?? ""} autoComplete="off" required />
          <Field
            label={paypal.configured ? "Segredo (em branco mantém o atual)" : "Segredo (secret)"}
            name="secret"
            type="password"
            autoComplete="off"
            required={!paypal.configured}
          />
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Moeda" name="currency" defaultValue={paypal.currency}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </SelectField>
            <Field label="Kwanzas por 1 unidade" name="exchangeRate" inputMode="decimal" defaultValue={paypal.exchangeRate ?? ""} placeholder="950" required />
          </div>
          <Sandbox checked={paypal.sandbox} />
        </ActionForm>
        {paypal.configured && (
          <div className="mt-4 border-t border-line pt-4">
            <ActionForm action={removePaymentMethodAction.bind(null, kind, id, "PAYPAL")} submitLabel="Desligar" submitVariant="secondary">
              {null}
            </ActionForm>
          </div>
        )}
      </Card>
    </div>
  );
}
