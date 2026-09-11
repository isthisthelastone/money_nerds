# Sender-bank opening buttons

Reviewed 2026-09-11. These links help a donor open their **sending bank** after
copying the recipient's phone. They do not create, prefill or confirm a payment.
No bank authentication or real transfer was performed during research.

The manual SBP panel now shows a bank-specific action immediately after the
phone/copy control. Each action states its actual capability. An ordinary bank
website must not be presented as a guaranteed native-app launch. Links open on
a user click, with no referrer, no recipient parameters and no invented schemes.
The existing bank-issued collection links, opt-in privacy gates, private
instruction QR, and verified donation totals are unchanged.

## Reviewed bank destinations

| Bank | Button destination / capability | First-party evidence |
| --- | --- | --- |
| Sberbank | `https://online.sberbank.ru/CSAFront/index.do` — web bank | [Sber app page publishes this web fallback](https://apps.sber.ru/apps/sberbank-online/), [NSPK transfer steps](https://sbp.nspk.ru/participants/5b8100bf-e723-4d12-a49b-58651ea3ce18) |
| T-Bank | `https://l.tbank.ru/help_transfers_by_phone` — bank-published phone-transfer smart link | [Phone-transfer guide and “Transfer money” CTA](https://www.tbank.ru/bank/help/payments/transfers/russia/phone/) |
| Alfa-Bank | `https://web.alfabank.ru/` — web bank | [Official address](https://digital.alfabank.ru/digest/retail/new-click), [transfer guide](https://alfabank.ru/everyday/payments-and-transfers/transfers-by-phone-number/) |
| Ozon Bank | `https://finance.ozon.ru/` — official bank website | [Personal-bank entry](https://finance.ozon.ru/), [app options](https://finance.ozon.ru/promo/app) |
| VTB | `https://online.vtb.ru/` — web bank | [Web-bank address](https://www.vtb.ru/personal/online-servisy/vtb-online-lite/), [SBP guide](https://www.vtb.ru/personal/online-servisy/perevody-sbp/) |
| Gazprombank | `https://ib.online.gpb.ru/` — web bank | [Official SBP page and internet-bank navigation](https://www.gazprombank.ru/personal/page/sbp/) |
| Raiffeisenbank | `https://online.raiffeisen.ru/` — web bank | [Official homepage link](https://www.raiffeisen.ru/), [online-bank/SBP help](https://www.raiffeisen.ru/retail/remote_service/information-centr/knowledgebase/konsultaciya_po_onlajn-banku/) |
| Sovcombank | `https://online.sovcombank.ru/` — web bank | [Bank terms §10.2.1](https://sovcombank.ru/document/13916), [SBP transfer guide](https://sovcombank.ru/apply/sbp/perevody-po-karte/) |
| PSB | `https://www.psbank.ru/personal/remote/inner_apps` — official app options, not direct launch | [Android/iPhone options](https://www.psbank.ru/personal/remote/inner_apps), [SBP explanation](https://www.psbank.ru/articles/chto-takoe-sbp) |
| Ak Bars | `https://online.akbars.ru/` — web bank | [Official user guide](https://online.akbars.ru/documents/AK%20BARS%20Online%20User%60s%20Guide.pdf), [SBP steps](https://life.akbars.ru/personal-finance/ekonomim/sistema-bystrykh-platezhey/) |
| Yandex Bank | `https://bank.yandex.ru/` — web bank with documented phone transfers | [Web and app transfer help](https://yandex.ru/support/pay-card/ru/operations/transfers), [app availability](https://yandex.ru/support/pay-card/ru/card-app) |
| MTS Bank | `https://www.mtsbank.ru/chastnim-licam/vse-servici/perevody-po-nomeru/` — official transfer guide/app options | [Current phone-transfer guide](https://www.mtsbank.ru/chastnim-licam/vse-servici/perevody-po-nomeru/) |

T-Bank's exact CTA routes desktop visitors to its apps page; mobile routing is
owned by the bank. A physical-device launch is not established by that HTTP
redirect. Never add guessed phone, amount or destination-bank parameters.

For Ozon, a deeper login route could not be verified against accessible official
links, so use the known bank entry instead. For MTS, the bank published
`payments.mts.ru` in a 2022 notice, but that old reference alone is insufficient
to present it as a current personal-bank launch target; use the current guide.
Some bank sites blocked automated live fetching. Indexed official sources
establish published destinations, not live logged-in transfer behavior.

## Public API findings

No unrestricted website-to-personal-SBP phone-and-bank-prefill contract was found
in the reviewed material for these twelve banks. This is a research result, not
proof that a bank can never offer such an integration.

Do not repurpose merchant integrations for C2C transfers:

- [Sber API](https://developers.sber.ru/docs/ru/sber-api/scenarios/sbp/overview)
  covers registered business scenarios.
- [Ozon SBP acquiring](https://finance.ozon.ru/business/acquiring/sbp),
  [Alfa business SBP](https://alfabank.ru/sme/payservice/sbp/) and
  [VTB business SBP](https://www.vtb.ru/malyj-biznes/acquiring/sistema-bystryh-platezhey/)
  are merchant products.
- [Yandex SBP-button API](https://pay.yandex.ru/docs/ru/payments/sbp-only-flow)
  creates merchant checkout orders.
- [PSB B2C](https://www.psbank.ru/business/sbp-dlia-fiz-lic) is business-account
  payouts, not an arbitrary donor's personal-bank action.

The restricted NSPK C2C participant API and bank-issued collection behavior are
documented separately in [sbp-research.md](./sbp-research.md).
