# Item Heatmap Widget for Zabbix

Widget custom de dashboard para Zabbix que transforma histórico numérico em um heatmap semanal por `dia da semana x faixa horária`.

O objetivo do módulo é responder uma pergunta que gráficos tradicionais nem sempre deixam clara:

**em que momento da semana um comportamento se concentra?**

Isso funciona muito bem para contadores derivados de logs, retries, exceptions, timeouts, filas, jobs recorrentes e qualquer métrica numérica que tenha padrão operacional ao longo dos dias.

![Heatmap Example](docs/images/heatmap-example.png)

## Visão geral

| Item | Valor |
| --- | --- |
| Tipo | Widget custom para dashboard do Zabbix |
| Nome exibido | `Item Heatmap` |
| Atualização | `60s` |
| Janela navegável | `4`, `8`, `12`, `24` ou `52` semanas |
| Granularidade | `30 min`, `1h`, `2h`, `4h`, `6h` ou `12h` |
| Formato de hora | `12h AM/PM`, `12h sem AM/PM` ou `24h` |
| Agregações | `Sum`, `Average`, `Maximum`, `Count non-zero` |
| Itens | um ou mais itens numéricos |
| Exibição | `Consolidated` ou `Compare items` |

## O que o widget entrega

- heatmap semanal com foco em recorrência operacional
- suporte a múltiplos itens no mesmo widget
- modo consolidado ou comparativo por item
- tooltip detalhado por bucket
- drill-down por célula com links para telas nativas do Zabbix
- navegação semana a semana com lazy load
- cache simples por semana para reduzir recálculo
- adaptação visual ao tema atual do Zabbix
- layout com células quadradas para leitura mais equilibrada

## Galeria

### Configuração do widget

Os campos abaixo permitem escolher itens, agregação, modo de exibição, granularidade, formato de hora, título interno e legenda opcional.

![Widget Config](docs/images/widget-config.png)

### Navegação semanal

O widget carrega apenas a semana atual na primeira renderização. As setas buscam semanas adicionais sob demanda.

![Heatmap Week Navigation](docs/images/heatmap-week-navigation.png)

### Tooltip expandido

Ao passar o mouse em uma célula, o widget mostra a semana, o dia, a faixa horária, o valor agregado, problemas relacionados, latest value e contexto do item.

![Heatmap Tooltip](docs/images/heatmap-tooltip.png)

### Drill-down por célula

Ao clicar em uma célula com valor ou problema associado, o widget abre um menu com links para `Exact graph`, `History values`, `Latest data` e `Related problems` no intervalo exato do bucket.

![Heatmap Drill-down](docs/images/heatmap-drilldown.png)

## Como o widget funciona

O módulo trabalha sobre itens numéricos do Zabbix. Ele não lê logs diretamente.

Fluxo típico:

```text
Fonte de dados
    -> item no Zabbix
    -> item numérico derivado
    -> Item Heatmap Widget
```

Exemplo com logs:

```text
Log do container
    -> item mestre de log
    -> item dependente numérico
    -> heatmap no dashboard
```

## Modos de agregação

O widget aceita múltiplos `itemids` e aplica a agregação escolhida em cada bucket.

| Agregação | Regra aplicada no bucket |
| --- | --- |
| `Sum` | soma de todos os valores de todos os itens |
| `Average` | média de todos os valores de todos os itens |
| `Maximum` | maior valor entre todos os itens |
| `Count non-zero` | quantidade de amostras com valor maior que zero |

## Modos de exibição

### Consolidated

Todos os itens selecionados são combinados em uma única grade. Esse modo destaca volume total, picos agregados e janelas mais quentes da semana.

### Compare items

Cada item passa a ter seu próprio painel dentro do widget. Esse modo é o mais útil quando você quer comparar containers, filas, serviços ou categorias de erro sem misturar tudo na mesma célula.

Quando há muitos itens, o widget usa scroll vertical apenas na área interna do heatmap para preservar legibilidade.

## Interações

### Tooltip

O tooltip mostra:

- semana exibida
- dia da semana
- faixa horária exata do bucket
- valor agregado
- quantidade de problemas associados
- latest value e idade da última amostra
- quebra por item quando aplicável

### Clique na célula

O clique funciona apenas em buckets com valor ou problema associado. A partir dele, o usuário pode abrir rapidamente as telas nativas do Zabbix relacionadas ao mesmo intervalo.

### Navegação por semana

- `prev`: busca a semana anterior
- `next`: volta em direção à semana atual

O frontend mantém em memória as semanas que já foram abertas durante a vida do widget, evitando requests repetidos para a mesma janela.

## Layout e experiência visual

- as células usam geometria quadrada para manter o mesmo respiro horizontal e vertical
- os valores ficam centralizados no bucket
- a paleta respeita o tema atual do Zabbix para bordas, texto e células vazias
- o widget não impõe um fundo próprio, usando o fundo padrão do painel do Zabbix
- a escala `Low -> High` permanece consistente para leitura operacional

## Configuração do widget

Campos principais:

- `Items`: um ou mais itens numéricos
- `Aggregation`: regra usada por bucket
- `Display mode`: `Consolidated` ou `Compare items`
- `Period window`: `4`, `8`, `12`, `24` ou `52` semanas
- `Granularity`: `30 min`, `1h`, `2h`, `4h`, `6h` ou `12h`
- `Hour format`: `12-hour (AM/PM)`, `12-hour (no AM/PM)` ou `24-hour`
- `Show display title`: mostra um título interno no corpo do widget
- `Display title`: texto livre para nomear o contexto observado
- `Show legend`: mostra ou oculta a linha de contexto
- `Legend / context`: descrição livre para containers, serviços ou escopo do widget

## Performance e arquitetura

### Lazy load por semana

- a primeira renderização carrega apenas a semana atual
- as demais semanas são carregadas sob demanda
- o backend aceita `week_start_ts` para responder somente a semana solicitada

### Cache

O backend usa cache simples por arquivo temporário para reduzir recálculo repetido.

Chave atual:

- `itemids`
- `aggregation`
- `week_start_ts`
- `slot_seconds`

TTL atual:

- `180` segundos

### History vs Trends

O acesso aos dados foi isolado em uma camada dedicada para facilitar evolução entre `history` e `trends`.

Comportamento atual:

- buckets recentes usam `history`
- semanas mais antigas podem usar `trends` para `Sum`, `Average` e `Maximum`
- granularidade abaixo de `1h` continua em `history`
- `Count non-zero` continua em `history`, porque depende de contagem exata de amostras positivas
- se `trends` não for adequado para a consulta, o código faz fallback para `history`

## Instalação

### 1. Copie o módulo para o frontend do Zabbix

Exemplo em ambiente Docker:

```bash
docker cp zabbix-item-heatmap-widget zabbix-web:/usr/share/zabbix/modules/
```

Em instalações tradicionais, copie a pasta do repositório para o diretório de módulos do frontend do Zabbix.

### 2. Faça o scan do diretório de módulos

No Zabbix:

```text
Administration -> Modules
```

Clique em `Scan directory`.

### 3. Habilite o módulo

Na mesma tela, localize `Item Heatmap` e clique em `Enable`.

## Adicionando ao dashboard

1. Abra o dashboard desejado.
2. Clique em `Edit dashboard`.
3. Clique em `Add widget`.
4. Selecione `Item Heatmap`.
5. Escolha um ou mais itens numéricos.
6. Defina agregação, modo de exibição, janela, granularidade e formato de hora.
7. Opcionalmente configure título interno e legenda.
8. Salve o dashboard.

## Pipeline recomendado para logs

Esse é o caso de uso mais comum do módulo.

### 1. Crie um item mestre de log

Use um item que capture os logs do container ou serviço desejado.

### 2. Crie um item dependente numérico

Exemplo:

- `Type`: `Dependent item`
- `Type of information`: `Numeric (unsigned)`
- `Master item`: item de logs do container

### 3. Adicione preprocessing para contar ocorrências

Exemplo simples para contar `ERROR`:

```javascript
var matches = value.match(/ERROR/g);
return matches ? matches.length : 0;
```

Repita a mesma ideia para `WARNING`, `TIMEOUT`, `EXCEPTION` ou qualquer padrão que faça sentido no seu ambiente.

### 4. Valide o item derivado

No Zabbix:

```text
Monitoring -> Latest data
```

O item derivado deve retornar um valor numérico a cada coleta.

### 5. Use o item no heatmap

Depois que o item estiver gerando histórico de forma consistente, selecione-o no widget e escolha a agregação e o modo de exibição mais adequados para o seu caso.

## Como interpretar o heatmap

Cada célula representa:

```text
dia da semana + bucket horário
```

Leitura visual:

- tons neutros indicam menor intensidade
- tons quentes indicam maior concentração relativa na semana exibida
- o número dentro da célula mostra o valor agregado do bucket
- o tooltip mostra o contexto detalhado do bucket
- o clique abre o drill-down para o intervalo exato
- problemas relacionados destacam buckets com contexto operacional relevante

## Limitações atuais

- no modo consolidado, links de gráfico e histórico usam o item principal do widget
- o menu de drill-down ainda não faz merge de múltiplos itens em uma única tela nativa do Zabbix
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

O `Item Heatmap` transforma histórico numérico em uma leitura operacional sobre **quando** um comportamento acontece. Com suporte a múltiplos itens, comparação visual, granularidade configurável, formatos de hora, tooltip detalhado, drill-down por bucket, navegação semanal e integração com `Problems` e `Latest data`, o widget cobre melhor recorrência, investigação rápida e acompanhamento semanal dentro do próprio dashboard do Zabbix.

## Licença

MIT
