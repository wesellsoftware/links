# WeSell — Diretrizes de atribuição (origem, canal, campanha)

Documento de referência para implementar o rastreamento de atribuição em qualquer página WeSell (links, form, diagnóstico, landing pages, etc.).

---

## 1. Conceito

O visitante chega com parâmetros na URL. Esses valores são:

1. **Capturados** ao carregar a página
2. **Persistidos** (sessionStorage + cookie no domínio `.wesellsoftware.com.br`)
3. **Propagados** aos próximos links internos
4. **Enviados** ao CRM / webhook / formulário

### Fluxo exemplo

```
Origem (bio Instagram)
  https://links.wesellsoftware.com.br/?origem=organico&canal=instagram&campanha=link_bio_instagram
        │
        ▼ clique no banner CRM
  https://form.wesellsoftware.com.br/?origem=organico&canal=instagram&campanha=pagina_vendas_crm
        │
        ▼ submit do formulário
  CRM grava: origem=organico | canal=instagram | campanha=pagina_vendas_crm
```

- `origem` e `canal` geralmente **permanecem** da entrada
- `campanha` é **atualizada** conforme a página/ação do clique

---

## 2. Campos do CRM (use sempre as chaves)

> Use **somente** os identificadores abaixo. Nunca envie o label amigável (`Instagram`, `Orgânico`, etc.).

### Origem — identificador: `origem`

| Chave | Label |
|---|---|
| `prospeccao_ativa` | Prospecção Ativa |
| `organico` | Orgânico |
| `indicacao` | Indicação |
| `trafego_pago` | Tráfego Pago |

### Canal — identificador: `canal`

| Chave | Label |
|---|---|
| `evento` | Evento/Feira/Congresso |
| `site` | Site WeSell |
| `parceiro` | Parceiro |
| `cliente` | Cliente |
| `instagram` | Instagram |
| `pagina_venda` | Páginas de Venda |

### Campanha — identificador: `campanha`

| Chave | Label |
|---|---|
| `diagnostico` | Diagnostico |
| `link_bio_instagram` | Link da Bio - Instagram |
| `form_solutions` | Formulário Solutions |
| `pagina_vendas_crm` | Página de Vendas - CRM |
| `link_bio_tiktok` | Link da Bio - TikTok |

> Se precisar de um valor novo, **crie a opção no CRM primeiro** e só depois use a chave no código/URL.

---

## 3. Regras de URL

1. O primeiro parâmetro usa `?`, os seguintes usam `&`
2. Valores em **minúsculo**, snake_case, exatamente como na tabela
3. Não use `utm_source` / `utm_medium` / `utm_campaign` para esses campos do CRM — use `origem`, `canal`, `campanha`
4. Ordem sugerida: `origem` → `canal` → `campanha`

**Correto**
```
https://links.wesellsoftware.com.br/?origem=organico&canal=instagram&campanha=link_bio_instagram
```

**Incorreto**
```
https://links.wesellsoftware.com.br/utm_source=Instagram
https://links.wesellsoftware.com.br/?origem=Orgânico&canal=Instagram
```

---

## 4. Operação — links de entrada (bio, ads, parceiros)

Monte o link **antes** de publicar. Exemplos:

| Onde publica | URL sugerida |
|---|---|
| Bio Instagram | `https://links.wesellsoftware.com.br/?origem=organico&canal=instagram&campanha=link_bio_instagram` |
| Bio TikTok | `https://links.wesellsoftware.com.br/?origem=organico&canal=instagram&campanha=link_bio_tiktok` |
| Anúncio Meta (pago) | `https://links.wesellsoftware.com.br/?origem=trafego_pago&canal=instagram&campanha=link_bio_instagram` |
| Indicação / parceiro | `https://links.wesellsoftware.com.br/?origem=indicacao&canal=parceiro` |
| Evento / feira | `https://links.wesellsoftware.com.br/?origem=prospeccao_ativa&canal=evento` |
| Link direto para o form | `https://form.wesellsoftware.com.br/?origem=organico&canal=site&campanha=pagina_vendas_crm` |
| Link direto para diagnóstico | `https://dgn.wesellsoftware.com.br/?origem=organico&canal=site&campanha=diagnostico` |

Checklist operacional:

- [ ] Chaves batem com o CRM
- [ ] Link testado no celular (Instagram/WhatsApp às vezes reescrevem URLs)
- [ ] Destino final realmente recebe e grava os 3 campos

---

## 5. Script compartilhado (`wesell-utm.js`)

Arquivo no repositório da links page: `wesell-utm.js`

### Inclusão mínima em qualquer página

```html
<script src="https://links.wesellsoftware.com.br/wesell-utm.js"></script>
<script>
  WeSellUtm.init({
    // Opcional: força a campanha desta página
    // campanha: "pagina_vendas_crm",
    linkSelector: "a[href]",
    domains: ["wesellsoftware.com.br"],
    fillForms: true,
  });
</script>
```

### Opções de `init`

| Opção | Padrão | Descrição |
|---|---|---|
| `origem` / `canal` / `campanha` | — | Sobrescreve / define valores nesta página |
| `linkSelector` | `a[href][data-campanha], a[href][data-utm-link]` | Quais links receberão os params |
| `domains` | `["wesellsoftware.com.br"]` | Domínios elegíveis para auto-propagação |
| `fillForms` | `true` | Preenche inputs `name="origem\|canal\|campanha"` |
| `autoApplyLinks` | `true` | Aplica UTMs nos links no load |

### Atributos HTML úteis

```html
<!-- Define/atualiza campanha ao clicar neste link -->
<a href="https://form.wesellsoftware.com.br" data-campanha="pagina_vendas_crm">CRM</a>

<!-- Força tracking mesmo fora do seletor padrão -->
<a href="https://dgn.wesellsoftware.com.br" data-utm-link data-campanha="diagnostico">Diagnóstico</a>

<!-- Não propagar UTMs neste link -->
<a href="https://www.instagram.com/wesellsoftware/" data-utm-ignore>Instagram</a>
```

Também aceita `data-origem` e `data-canal` quando precisar sobrescrever no clique.

### Campos hidden no formulário (recomendado)

```html
<form id="lead-form">
  <!-- campos visíveis do lead -->
  <input type="text" name="name" />
  <input type="email" name="email" />

  <!-- preenchidos automaticamente pelo WeSellUtm.init({ fillForms: true }) -->
  <input type="hidden" name="origem" />
  <input type="hidden" name="canal" />
  <input type="hidden" name="campanha" />

  <button type="submit">Enviar</button>
</form>
```

### API JavaScript

```js
// Ler valores atuais
WeSellUtm.get();
// → { origem: "organico", canal: "instagram", campanha: "link_bio_instagram" }

// Atualizar manualmente
WeSellUtm.set({ campanha: "pagina_vendas_crm" });

// Montar URL com tracking
WeSellUtm.appendToUrl("https://form.wesellsoftware.com.br", {
  campanha: "pagina_vendas_crm",
});

// Query string pronta
WeSellUtm.toQueryString();
// → "origem=organico&canal=instagram&campanha=pagina_vendas_crm"

// Reaplicar em links / forms depois de render dinâmico
WeSellUtm.applyToLinks("a[href]", ["wesellsoftware.com.br"]);
WeSellUtm.fillForms(document.getElementById("lead-form"));
```

### Persistência

| Camada | Escopo | Uso |
|---|---|---|
| Query string | Página atual | Fonte de verdade na chegada |
| `sessionStorage` | Mesma aba / mesmo host | Fallback local |
| Cookie `wesell_utm` | `*.wesellsoftware.com.br` (30 dias) | Continuidade entre subdomínios |

Prioridade de merge: **URL > sessionStorage > cookie** (valores da URL ganham).

---

## 6. Checklist por tipo de página

### Página de links (hub)

- [ ] Incluir `wesell-utm.js`
- [ ] Cada CTA interno com `data-campanha` correto
- [ ] Links externos (Instagram, etc.) com `data-utm-ignore`
- [ ] WhatsApp: o script anexa `[origem:… \| canal:… \| campanha:…]` no texto da mensagem

Mapeamento atual da links page:

| Banner | `data-campanha` |
|---|---|
| Solutions (WhatsApp) | `form_solutions` |
| CRM | `pagina_vendas_crm` |
| Diagnóstico | `diagnostico` |
| Education (modal) | — (sem opção CRM; envia só origem/canal no webhook) |

### Página de formulário / vendas (`form.*`)

- [ ] Incluir `wesell-utm.js` + `init({ campanha: "pagina_vendas_crm", fillForms: true })` se esta for a campanha padrão da página
- [ ] Hidden inputs `origem`, `canal`, `campanha`
- [ ] Backend / CRM mapear esses campos para o negócio
- [ ] Propagar tracking em CTAs para outras páginas WeSell

### Página de diagnóstico (`dgn.*`)

- [ ] Mesmo padrão do form
- [ ] Preferir `campanha=diagnostico` (via URL de entrada ou `init`)

### Landing / página de vendas avulsa

- [ ] Definir `campanha` da página no `init` **ou** nos links de entrada
- [ ] Não sobrescrever `origem`/`canal` se já vierem na URL
- [ ] Todo botão que leva a outro domínio WeSell deve manter a atribuição

### Integração via webhook / API

Envie no payload JSON:

```json
{
  "origem": "organico",
  "canal": "instagram",
  "campanha": "pagina_vendas_crm"
}
```

Obtenha os valores com `WeSellUtm.get()` no submit.

---

## 7. Casos especiais

### WhatsApp (`wa.me`)

Query params UTM **não** alimentam o CRM. O script:

1. Mantém o texto original da mensagem
2. Anexa um marcador no final, ex.: `[origem:organico | canal:instagram | campanha:form_solutions]`

Se o atendimento precisar da atribuição no CRM, o time deve copiar/interpretar esse marcador, **ou** preferir um formulário web que grave os campos.

### SPA / conteúdo dinâmico

Depois de inserir links/forms via JS:

```js
WeSellUtm.applyToLinks("a[href]", ["wesellsoftware.com.br"]);
WeSellUtm.fillForms();
```

### Teste local (`localhost` / `file://`)

O cookie cross-subdomain não se aplica. A propagação ainda funciona porque os params vão na **query string** do próximo link. Em produção (`*.wesellsoftware.com.br`) o cookie reforça a continuidade.

---

## 8. Teste de aceite (obrigatório antes de publicar)

1. Abra a página com params na URL  
   `?origem=organico&canal=instagram&campanha=link_bio_instagram`
2. No DevTools → Application → Session Storage / Cookies, confirme `wesell_utm`
3. Clique em um CTA interno e confira a URL de destino (params preservados + `campanha` atualizada se houver `data-campanha`)
4. No formulário, confira se os hidden foram preenchidos
5. Envie um lead de teste e valide no CRM os 3 campos

---

## 9. Snippet pronto para copiar

```html
<!-- 1. Script -->
<script src="https://links.wesellsoftware.com.br/wesell-utm.js"></script>
<script>
  WeSellUtm.init({
    campanha: "pagina_vendas_crm", // ajuste por página
    linkSelector: "a[href]",
    domains: ["wesellsoftware.com.br"],
    fillForms: true,
  });
</script>

<!-- 2. Form -->
<form id="lead-form">
  <input type="hidden" name="origem" />
  <input type="hidden" name="canal" />
  <input type="hidden" name="campanha" />
  <!-- demais campos -->
</form>

<!-- 3. CTA para outra página WeSell -->
<a
  href="https://dgn.wesellsoftware.com.br"
  data-campanha="diagnostico"
>
  Fazer diagnóstico
</a>
```

---

## 10. Resumo rápido

| Camada | O que fazer |
|---|---|
| **Operação** | Publicar links de bio/ads já com `?origem=&canal=&campanha=` |
| **Front** | Incluir `wesell-utm.js` + `init` + hidden fields / `data-campanha` |
| **Destino** | Gravar `origem`, `canal`, `campanha` no CRM com as chaves oficiais |
| **Não fazer** | Usar labels, inventar chaves sem cadastrar no CRM, ou confiar só no WhatsApp para atribuição estruturada |
