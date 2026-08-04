# WeSell — Diretrizes de atribuição (origem, canal, campanha, jornada)

Documento de referência para implementar o rastreamento de atribuição em qualquer página WeSell (links, form, diagnóstico, landing pages, etc.).

---

## 1. Conceito

O visitante chega com parâmetros na URL. Esses valores são:

1. **Capturados** ao carregar a página
2. **Persistidos** (sessionStorage + cookie no domínio `.wesellsoftware.com.br`)
3. **Propagados e empilhados** nos próximos cliques (banners / CTAs)
4. **Enviados** ao CRM / webhook / formulário

### Fluxo exemplo (links page)

```
1. Lead no Instagram clica no link da bio
   https://links.wesellsoftware.com.br/?origem=organico&canal=instagram&campanha=link_bio_instagram
   (aliases aceitos: utm_source / utm_channel / utm_campaign)

2. Abre a página de links — UTMs já devem estar na URL
   (a página NÃO inventa UTMs; eles precisam vir no link da bio)

3. Lead clica no banner CRM (LP), Solutions (form) ou Diagnóstico
   Nesse momento o script EMPILHA a jornada e propaga:

   https://form.wesellsoftware.com.br/?origem=organico
     &canal=instagram
     &campanha=wesell-CRM
     &campanha_lead=link_bio_instagram|wesell-CRM
     &utm_campaign=link_bio_instagram|wesell-CRM
     &jornada=organico|instagram|link_bio_instagram|wesell-CRM
     &utm_source=organico
     &utm_channel=instagram
     &utm_content=organico|instagram|link_bio_instagram|wesell-CRM
```

### Regras de herança e empilhamento

| Campo | Comportamento |
|---|---|
| `origem` | **Herdado** da entrada. Só chaves CRM: `prospeccao_ativa`, `organico`, `indicacao`, `trafego_pago`. |
| `canal` | **Herdado** da entrada. Só chaves CRM: `evento`, `site`, `parceiro`, `cliente`, `instagram`, `pagina_venda`. |
| `campanha` | **Último passo** (campanha do banner clicado). |
| `utm_campaign` / `campanha_lead` | **Só entrada + banner clicado** (`link_bio_instagram\|wesell-CRM`). Não acumula cliques anteriores. |
| `jornada` / `utm_content` | Trilha: `origem\|canal\|campanha_entrada\|banner` |

---

## 2. Campos do CRM (use sempre as chaves)

> Use **somente** os identificadores abaixo. Nunca envie o label amigável (`Instagram`, `Orgânico`, etc.).

### Origem — identificador: `origem`

> **Somente** estas chaves. Labels amigáveis (`Orgânico`, `Instagram`, etc.) são inválidos.

| Chave | Label |
|---|---|
| `prospeccao_ativa` | Prospecção Ativa |
| `organico` | Orgânico |
| `indicacao` | Indicação |
| `trafego_pago` | Tráfego Pago |

### Canal — identificador: `canal`

> **Somente** estas chaves.

| Chave | Label |
|---|---|
| `evento` | Evento/Feira/Congresso |
| `site` | Site WeSell |
| `parceiro` | Parceiro |
| `cliente` | Cliente |
| `instagram` | Instagram |
| `pagina_venda` | Páginas de Venda |

### Mapeamento de aliases (Meta / entrada)

A links page **normaliza** valores extras da Meta para o padrão CRM. Campanha continua concatenando o caminho.

| Valor na URL | Vira no CRM |
|---|---|
| `origem=organico` | `origem=organico` |
| `canal=instagram` | `canal=instagram` |
| `utm_source=ig` | `canal=instagram` (nunca origem) |
| `utm_source=instagram` | `canal=instagram` |
| `utm_medium=social` | ignorado sozinho (não é canal CRM) |
| `utm_source=cpc` / `paid` / `ads` | `origem=trafego_pago` |
| `utm_source=organic` | `origem=organico` |

**Exemplo bio Instagram (recomendado)**
```
https://links.wesellsoftware.com.br/?origem=organico&canal=instagram&campanha=link_bio_instagram
```

Os `utm_source=ig&utm_medium=social` da Meta podem coexistir na URL, mas **não substituem** `origem`/`canal` do CRM.

### Campanha — identificador: `campanha` (alias: `utm_campaign`)

#### Entrada (bio / ads)

| Chave | Label |
|---|---|
| `link_bio_instagram` | Link da Bio - Instagram |
| `link_bio_tiktok` | Link da Bio - TikTok |

#### Produtos (banners da links page)

| Chave | Label | Onde usa |
|---|---|---|
| `wesell-education` | WeSell Education | Banner 1 + modal de pré-inscrição |
| `wesell-CRM` | WeSell CRM | Banner 2 (`lp.wesellsoftware.com.br`) |
| `wesell-solutions` | WeSell Solutions | Banner 3 (`form.wesellsoftware.com.br`) |
| `wesell-diagnostico` | WeSell Diagnóstico | Banner 4 (`dgn.wesellsoftware.com.br`) |

> Se precisar de um valor novo, **crie a opção no CRM primeiro** e só depois use a chave no código/URL.

### Jornada — identificador: `jornada` (alias: `utm_content`)

Trilha empilhada com `|` para reconstruir o caminho do lead, ex.:

```
organico|instagram|link_bio_instagram|wesell-CRM
```

---

## 3. Regras de URL

1. O primeiro parâmetro usa `?`, os seguintes usam `&`
2. Valores exatamente como nas tabelas (sem acento, sem espaços)
3. Aceitos na **entrada**: `origem`/`canal`/`campanha` **ou** `utm_source`/`utm_channel`/`utm_campaign`
4. Na **saída** (clique do banner), o script envia **os dois formatos** (CRM + aliases UTM)
5. Ordem sugerida: `origem` → `canal` → `campanha`

**Correto (link da bio)**
```
https://links.wesellsoftware.com.br/?origem=organico&canal=instagram&campanha=link_bio_instagram
```

**Também correto (aliases UTM)**
```
https://links.wesellsoftware.com.br/?utm_source=organico&utm_channel=instagram&utm_campaign=link_bio_instagram
```

**Incorreto**
```
https://links.wesellsoftware.com.br/utm_source=Instagram
https://links.wesellsoftware.com.br/?origem=Orgânico&canal=Instagram
https://links.wesellsoftware.com.br/
← sem params: a página não preenche UTMs sozinha
```

---

## 4. Operação — links de entrada (bio, ads, parceiros)

> **Importante:** a página de links **não cria** UTMs na URL. Se o Instagram abrir `https://links.wesellsoftware.com.br/` sem query string, o link da bio está cadastrado **sem** parâmetros.

Monte o link **antes** de publicar. Exemplos:

| Onde publica | URL sugerida |
|---|---|
| Bio Instagram | `https://links.wesellsoftware.com.br/?origem=organico&canal=instagram&campanha=link_bio_instagram` |
| Bio TikTok | `https://links.wesellsoftware.com.br/?origem=organico&canal=instagram&campanha=link_bio_tiktok` |
| Anúncio Meta (pago) | `https://links.wesellsoftware.com.br/?origem=trafego_pago&canal=instagram&campanha=link_bio_instagram` |
| Indicação / parceiro | `https://links.wesellsoftware.com.br/?origem=indicacao&canal=parceiro` |
| Evento / feira | `https://links.wesellsoftware.com.br/?origem=prospeccao_ativa&canal=evento` |
| Link direto para Solutions | `https://form.wesellsoftware.com.br/?origem=organico&canal=site&campanha=wesell-solutions` |
| Link direto para diagnóstico | `https://dgn.wesellsoftware.com.br/?origem=organico&canal=site&campanha=wesell-diagnostico` |

Checklist operacional:

- [ ] Link da bio/ads **já inclui** `?origem=&canal=&campanha=`
- [ ] Chaves batem com o CRM
- [ ] Link testado no celular (Instagram/WhatsApp às vezes reescrevem URLs)
- [ ] Após clicar no banner, a URL de destino traz `utm_source` herdado + `utm_campaign` empilhado + `jornada`

---

## 5. Script compartilhado (`wesell-utm.js`)

Arquivo no repositório da links page: `wesell-utm.js`  
URL pública: `https://links.wesellsoftware.com.br/wesell-utm.js`

### Inclusão mínima em qualquer página

```html
<script src="https://links.wesellsoftware.com.br/wesell-utm.js"></script>
<script>
  WeSellUtm.init({
    // Opcional: força a campanha desta página
    // campanha: "wesell-solutions",
    linkSelector: "a[href]",
    domains: ["wesellsoftware.com.br", "wa.me", "api.whatsapp.com"],
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
| `fillForms` | `true` | Preenche inputs `name="origem\|canal\|campanha\|jornada"` (+ aliases utm_*) |
| `autoApplyLinks` | `true` | Aplica UTMs nos links no load |

### Atributos HTML úteis

```html
<!-- Define/atualiza campanha ao clicar neste link (empilha jornada) -->
<a href="https://form.wesellsoftware.com.br" data-campanha="wesell-solutions">Solutions</a>

<!-- Força tracking mesmo fora do seletor padrão -->
<a href="https://dgn.wesellsoftware.com.br" data-utm-link data-campanha="wesell-diagnostico">Diagnóstico</a>

<!-- Não propagar UTMs neste link -->
<a href="https://www.instagram.com/wesellsoftware/" data-utm-ignore>Instagram</a>
```

Também aceita `data-origem` e `data-canal` quando precisar sobrescrever no clique.

### Campos hidden no formulário (recomendado)

```html
<form id="lead-form">
  <input type="text" name="name" />
  <input type="email" name="email" />

  <input type="hidden" name="origem" />
  <input type="hidden" name="canal" />
  <input type="hidden" name="campanha" />
  <input type="hidden" name="jornada" />

  <button type="submit">Enviar</button>
</form>
```

### API JavaScript

```js
// Ler valores atuais
WeSellUtm.get();
// → {
//     origem: "organico",
//     canal: "instagram",
//     campanha: "link_bio_instagram|wesell-solutions",
//     jornada: "organico|instagram|link_bio_instagram|wesell-solutions"
//   }

// Empilhar campanha manualmente (ex.: submit Education)
WeSellUtm.set({ campanha: "wesell-education" });

// Montar URL com tracking empilhado
WeSellUtm.appendToUrl("https://form.wesellsoftware.com.br", {
  campanha: "wesell-solutions",
});

// Query string pronta (CRM + aliases UTM)
WeSellUtm.toQueryString();

// Reaplicar em links / forms depois de render dinâmico
WeSellUtm.applyToLinks("a[href]", ["wesellsoftware.com.br", "wa.me"]);
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
- [ ] Cada banner com `data-campanha` correto
- [ ] Links externos (Instagram do header/footer) com `data-utm-ignore`
- [ ] WhatsApp: o script anexa o marcador de tracking no texto da mensagem

Mapeamento atual da links page:

| # | Banner | Destino | `data-banner` | `data-campanha` |
|---|---|---|---|---|
| 1 | Education (modal pré-inscrição) | Modal → Sellflux | `Education` | `wesell-education` |
| 2 | CRM | `lp.wesellsoftware.com.br` | `CRM` | `wesell-CRM` |
| 3 | Solutions | `form.wesellsoftware.com.br` | `Solutions` | `wesell-solutions` |
| 4 | Diagnóstico | `dgn.wesellsoftware.com.br` | `Diagnostico` | `wesell-diagnostico` |

### Página de formulário / vendas (`form.*`)

- [ ] Incluir `wesell-utm.js` + `init({ fillForms: true })`
- [ ] Preferir campanha de entrada/propagada (`wesell-solutions`); só force no `init` se for acesso direto sem params
- [ ] Hidden inputs `origem`, `canal`, `campanha`, `jornada`
- [ ] Backend / CRM mapear esses campos
- [ ] Propagar tracking em CTAs para outras páginas WeSell

### Página de diagnóstico (`dgn.*`)

- [ ] Mesmo padrão do form
- [ ] Preferir `campanha=wesell-diagnostico`

### Landing / página de vendas avulsa

- [ ] Definir `campanha` da página no `init` **ou** nos links de entrada
- [ ] Não sobrescrever `origem`/`canal` se já vierem na URL
- [ ] Todo botão que leva a outro domínio WeSell deve manter a atribuição

### Integração via webhook / API

Payload típico (clique / lead):

```json
{
  "origem": "organico",
  "canal": "instagram",
  "campanha": "wesell-solutions",
  "jornada": "organico|instagram|link_bio_instagram|wesell-solutions",
  "utm_source": "organico",
  "utm_channel": "instagram",
  "utm_campaign": "link_bio_instagram|wesell-solutions"
}
```

Pré-inscrição Education (Sellflux) — campos do lead + tracking:

```json
{
  "name": "Nome",
  "email": "email@dominio.com",
  "phone": "+5511999999999",
  "tags": [],
  "remove_tags": [],
  "origem": "organico",
  "canal": "instagram",
  "campanha": "wesell-education"
}
```

Obtenha os valores com `WeSellUtm.get()` no submit.

---

## 7. Casos especiais

### WhatsApp (`wa.me`)

Query params UTM **não** alimentam o CRM. O script:

1. Mantém o texto original da mensagem
2. Anexa um marcador no final, ex.:  
   `[utm_source:organico | utm_channel:instagram | utm_campaign:link_bio_instagram|wesell-CRM | jornada:organico|instagram|link_bio_instagram|wesell-CRM]`

Se o atendimento precisar da atribuição no CRM, o time deve copiar/interpretar esse marcador, **ou** preferir um formulário web que grave os campos.

### SPA / conteúdo dinâmico

Depois de inserir links/forms via JS:

```js
WeSellUtm.applyToLinks("a[href]", ["wesellsoftware.com.br", "wa.me"]);
WeSellUtm.fillForms();
```

### Teste local (`localhost` / `file://`)

O cookie cross-subdomain não se aplica. A propagação ainda funciona porque os params vão na **query string** do próximo link. Em produção (`*.wesellsoftware.com.br`) o cookie reforça a continuidade.

---

## 8. Teste de aceite (obrigatório antes de publicar)

1. Abra a página **com** params na URL  
   `?origem=organico&canal=instagram&campanha=link_bio_instagram`
2. Confirme que a barra de endereço **mantém** os params (se abrir limpa, o link de entrada está errado)
3. No DevTools → Application → Session Storage / Cookies, confirme `wesell_utm`
4. Clique em um banner e confira a URL de destino:
   - `utm_source` / `origem` = `organico` (herdado)
   - `campanha` = campanha do banner (`wesell-CRM`, `wesell-solutions`, etc.)
   - `utm_campaign` e `jornada` empilhados com a entrada
5. No formulário, confira se os hidden foram preenchidos
6. Envie um lead de teste e valide no CRM / planilha / Sellflux

---

## 9. Snippet pronto para copiar

```html
<!-- 1. Script -->
<script src="https://links.wesellsoftware.com.br/wesell-utm.js"></script>
<script>
  WeSellUtm.init({
    // campanha: "wesell-solutions", // só se for a campanha padrão desta página
    linkSelector: "a[href]",
    domains: ["wesellsoftware.com.br", "wa.me", "api.whatsapp.com"],
    fillForms: true,
  });
</script>

<!-- 2. Form -->
<form id="lead-form">
  <input type="hidden" name="origem" />
  <input type="hidden" name="canal" />
  <input type="hidden" name="campanha" />
  <input type="hidden" name="jornada" />
  <!-- demais campos -->
</form>

<!-- 3. CTA para outra página WeSell -->
<a
  href="https://dgn.wesellsoftware.com.br"
  data-campanha="wesell-diagnostico"
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
| **Clique no banner** | Empilhar jornada; herdar `utm_source`; atualizar `campanha` do produto |
| **Destino** | Gravar `origem`, `canal`, `campanha`, `jornada` (e aliases UTM se útil) |
| **Não fazer** | Usar labels; inventar chaves sem cadastrar no CRM; esperar que a links page invente UTMs sem params na bio; confiar só no WhatsApp para atribuição estruturada |
