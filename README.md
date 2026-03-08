# Item Heatmap Widget for Zabbix

Widget custom de dashboard para Zabbix que transforma historico numerico em um heatmap semanal por `dia da semana x faixa horaria`.

O objetivo do modulo e responder uma pergunta que graficos tradicionais nem sempre deixam clara:

**em que momento da semana um comportamento se concentra?**

Isso funciona muito bem para contadores derivados de logs, retries, exceptions, timeouts, filas, jobs recorrentes e qualquer metrica numerica que tenha padrao operacional ao longo dos dias.

![Heatmap Example](docs/images/heatmap-example.png)

## Visao geral

| Item | Valor |
| --- | --- |
| Tipo | Widget custom para dashboard do Zabbix |
| Nome exibido | `Item Heatmap` |
| Atualizacao | `60s` |
| Janela navegavel | `4`, `8`, `12`, `24` ou `52` semanas |
| Granularidade | `30 min`, `1h`, `2h`, `4h`, `6h` ou `12h` |
| Formato de hora | `12h AM/PM`, `12h sem AM/PM` ou `24h` |
| Agregacoes | `Sum`, `Average`, `Maximum`, `Count non-zero` |
| Itens | um ou mais itens numericos |
| Exibicao | `Consolidated` ou `Compare items` |

## O que o widget entrega

- heatmap semanal com foco em recorrencia operacional
- suporte a multiplos itens no mesmo widget
- modo consolidado ou comparativo por item
- tooltip detalhado por bucket
- drill-down por celula com links para telas nativas do Zabbix
- navegacao semana a semana com lazy load
- cache simples por semana para reduzir recalculo
- adaptacao visual ao tema atual do Zabbix
- layout com celulas quadradas para leitura mais equilibrada

## Galeria

### Configuracao do widget

Os campos abaixo permitem escolher itens, agregacao, modo de exibicao, granularidade, formato de hora, titulo interno e legenda opcional.

![Widget Config](docs/images/widget-config.png)

### Navegacao semanal

O widget carrega apenas a semana atual na primeira renderizacao. As setas buscam semanas adicionais sob demanda.

![Heatmap Week Navigation](docs/images/heatmap-week-navigation.png)

### Tooltip expandido

Ao passar o mouse em uma celula, o widget mostra a semana, o dia, a faixa horaria, o valor agregado, problemas relacionados, latest value e contexto do item.

![Heatmap Tooltip](docs/images/heatmap-tooltip.png)

### Drill-down por celula

Ao clicar em uma celula com valor ou problema associado, o widget abre um menu com links para `Exact graph`, `History values`, `Latest data` e `Related problems` no intervalo exato do bucket.

![Heatmap Drill-down](docs/images/heatmap-drilldown.png)

## Como o widget funciona

O modulo trabalha sobre itens numericos do Zabbix. Ele nao le logs diretamente.

Fluxo tipico:

```text
Fonte de dados
    -> item no Zabbix
    -> item numerico derivado
    -> Item Heatmap Widget
```

Exemplo com logs:

```text
Log do container
    -> item mestre de log
    -> item dependente numerico
    -> heatmap no dashboard
```

## Modos de agregacao

O widget aceita multiplos `itemids` e aplica a agregacao escolhida em cada bucket.

| Agregacao | Regra aplicada no bucket |
| --- | --- |
| `Sum` | soma de todos os valores de todos os itens |
| `Average` | media de todos os valores de todos os itens |
| `Maximum` | maior valor entre todos os itens |
| `Count non-zero` | quantidade de amostras com valor maior que zero |

## Modos de exibicao

### Consolidated

Todos os itens selecionados sao combinados em uma unica grade. Esse modo destaca volume total, picos agregados e janelas mais quentes da semana.

### Compare items

Cada item passa a ter seu proprio painel dentro do widget. Esse modo e o mais util quando voce quer comparar containers, filas, servicos ou categorias de erro sem misturar tudo na mesma celula.

Quando ha muitos itens, o widget usa scroll vertical apenas na area interna do heatmap para preservar legibilidade.

## Interacoes

### Tooltip

O tooltip mostra:

- semana exibida
- dia da semana
- faixa horaria exata do bucket
- valor agregado
- quantidade de problemas associados
- latest value e idade da ultima amostra
- quebra por item quando aplicavel

### Clique na celula

O clique funciona apenas em buckets com valor ou problema associado. A partir dele, o usuario pode abrir rapidamente as telas nativas do Zabbix relacionadas ao mesmo intervalo.

### Navegacao por semana

- `prev`: busca a semana anterior
- `next`: volta em direcao a semana atual

O frontend mantem em memoria as semanas que ja foram abertas durante a vida do widget, evitando requests repetidos para a mesma janela.

## Layout e experiencia visual

- as celulas usam geometria quadrada para manter o mesmo respiro horizontal e vertical
- os valores ficam centralizados no bucket
- a paleta respeita o tema atual do Zabbix para bordas, texto e celulas vazias
- o widget nao impõe um fundo proprio, usando o fundo padrao do painel do Zabbix
- a escala `Low -> High` permanece consistente para leitura operacional

## Configuracao do widget

Campos principais:

- `Items`: um ou mais itens numericos
- `Aggregation`: regra usada por bucket
- `Display mode`: `Consolidated` ou `Compare items`
- `Period window`: `4`, `8`, `12`, `24` ou `52` semanas
- `Granularity`: `30 min`, `1h`, `2h`, `4h`, `6h` ou `12h`
- `Hour format`: `12-hour (AM/PM)`, `12-hour (no AM/PM)` ou `24-hour`
- `Show display title`: mostra um titulo interno no corpo do widget
- `Display title`: texto livre para nomear o contexto observado
- `Show legend`: mostra ou oculta a linha de contexto
- `Legend / context`: descricao livre para containers, servicos ou escopo do widget

## Performance e arquitetura

### Lazy load por semana

- a primeira renderizacao carrega apenas a semana atual
- as demais semanas sao carregadas sob demanda
- o backend aceita `week_start_ts` para responder somente a semana solicitada

### Cache

O backend usa cache simples por arquivo temporario para reduzir recalculo repetido.

Chave atual:

- `itemids`
- `aggregation`
- `week_start_ts`
- `slot_seconds`

TTL atual:

- `180` segundos

### History vs Trends

O acesso aos dados foi isolado em uma camada dedicada para facilitar evolucao entre `history` e `trends`.

Comportamento atual:

- buckets recentes usam `history`
- semanas mais antigas podem usar `trends` para `Sum`, `Average` e `Maximum`
- granularidade abaixo de `1h` continua em `history`
- `Count non-zero` continua em `history`, porque depende de contagem exata de amostras positivas
- se `trends` nao for adequado para a consulta, o codigo faz fallback para `history`

## Instalacao

### 1. Copie o modulo para o frontend do Zabbix

Exemplo em ambiente Docker:

```bash
docker cp zabbix-item-heatmap-widget zabbix-web:/usr/share/zabbix/modules/
```

Em instalacoes tradicionais, copie a pasta do repositorio para o diretorio de modulos do frontend do Zabbix.

### 2. Faca o scan do diretorio de modulos

No Zabbix:

```text
Administration -> Modules
```

Clique em `Scan directory`.

### 3. Habilite o modulo

Na mesma tela, localize `Item Heatmap` e clique em `Enable`.

## Adicionando ao dashboard

1. Abra o dashboard desejado.
2. Clique em `Edit dashboard`.
3. Clique em `Add widget`.
4. Selecione `Item Heatmap`.
5. Escolha um ou mais itens numericos.
6. Defina agregacao, modo de exibicao, janela, granularidade e formato de hora.
7. Opcionalmente configure titulo interno e legenda.
8. Salve o dashboard.

## Pipeline recomendado para logs

Esse e o caso de uso mais comum do modulo.

### 1. Crie um item mestre de log

Use um item que capture os logs do container ou servico desejado.

### 2. Crie um item dependente numerico

Exemplo:

- `Type`: `Dependent item`
- `Type of information`: `Numeric (unsigned)`
- `Master item`: item de logs do container

### 3. Adicione preprocessing para contar ocorrencias

Exemplo simples para contar `ERROR`:

```javascript
var matches = value.match(/ERROR/g);
return matches ? matches.length : 0;
```

Repita a mesma ideia para `WARNING`, `TIMEOUT`, `EXCEPTION` ou qualquer padrao que faca sentido no seu ambiente.

### 4. Valide o item derivado

No Zabbix:

```text
Monitoring -> Latest data
```

O item derivado deve retornar um valor numerico a cada coleta.

### 5. Use o item no heatmap

Depois que o item estiver gerando historico de forma consistente, selecione-o no widget e escolha a agregacao e o modo de exibicao mais adequados para o seu caso.

## Como interpretar o heatmap

Cada celula representa:

```text
dia da semana + bucket horario
```

Leitura visual:

- tons neutros indicam menor intensidade
- tons quentes indicam maior concentracao relativa na semana exibida
- o numero dentro da celula mostra o valor agregado do bucket
- o tooltip mostra o contexto detalhado do bucket
- o clique abre o drill-down para o intervalo exato
- problemas relacionados destacam buckets com contexto operacional relevante

## Limitacoes atuais

- no modo consolidado, links de grafico e historico usam o item principal do widget
- o menu de drill-down ainda nao faz merge de multiplos itens em uma unica tela nativa do Zabbix
- `Count non-zero` depende de `history`
- granularidades menores geram mais buckets e podem exigir widgets mais largos
- modo comparativo com muitos itens pode exigir scroll vertical para manter legibilidade

## Estrutura do projeto

```text
zabbix-item-heatmap-widget
|-- actions/
|   |-- WidgetEdit.php
|   `-- WidgetView.php
|-- assets/
|   |-- css/
|   |   `-- widget.css
|   `-- js/
|       `-- class.widget.js
|-- docs/
|   `-- images/
|-- includes/
|   |-- HeatmapDataProvider.php
|   `-- WidgetForm.php
|-- views/
|   |-- widget.edit.php
|   `-- widget.view.php
|-- manifest.json
|-- Module.php
|-- Widget.php
`-- README.md
```

## Resumo

O `Item Heatmap` transforma historico numerico em uma leitura operacional sobre **quando** um comportamento acontece. Com suporte a multiplos itens, comparacao visual, granularidade configuravel, formatos de hora, tooltip detalhado, drill-down por bucket, navegacao semanal e integracao com `Problems` e `Latest data`, o widget cobre melhor recorrencia, investigacao rapida e acompanhamento semanal dentro do proprio dashboard do Zabbix.

## Licenca

MIT
