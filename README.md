# Item Heatmap Widget for Zabbix

Módulo de dashboard para Zabbix que transforma itens numéricos em um **heatmap semanal por dia da semana x hora**, facilitando a leitura de recorrência, concentração e comportamento operacional ao longo da semana.

O widget foi pensado para cenários em que olhar apenas para gráfico ou tabela não responde rapidamente perguntas como:

- Em quais horários os erros se concentram?
- Existe recorrência por dia da semana?
- O comportamento piora em janelas específicas?
- Vários itens apresentam carga combinada em determinados períodos?

![Heatmap Example](docs/images/heatmap-example.png)

A captura acima mostra o layout final do widget; os valores exibidos dependem do historico real dos itens selecionados na semana consultada.

## Visão geral

| Item | Valor |
| --- | --- |
| Tipo | Widget custom para dashboard do Zabbix |
| Nome exibido | `Item Heatmap` |
| Versão do módulo | `1.0.0` |
| Granularidade | 1 hora |
| Faixa navegável | semana atual + 11 semanas anteriores |
| Atualização automática | `60s` |
| Agregações | `Sum`, `Average`, `Maximum`, `Count non-zero` |
| Seleção de itens | um ou mais itens agregados no mesmo mapa |

## O que o widget resolve

O Zabbix já mostra histórico, latest data e gráficos. O papel deste widget é outro: condensar o histórico em uma matriz **7 dias x 24 horas** para mostrar rapidamente onde os valores se concentram.

Isso é especialmente útil para:

- logs de erro transformados em contadores
- retries, exceções e timeouts recorrentes
- bursts de filas ou jobs agendados
- correlação visual de múltiplos itens numéricos em uma mesma grade horária
- análise operacional de comportamento semanal

## Como o widget funciona

O módulo **não lê logs diretamente**. Ele trabalha sobre itens históricos do Zabbix e monta um heatmap agregado por semana.

Fluxo recomendado:

```text
Fonte de dados
    -> item no Zabbix
    -> item numérico derivado
    -> Item Heatmap Widget
```

Exemplo clássico com logs:

```text
Log do container
    -> item mestre de log
    -> item dependente numérico
    -> heatmap no dashboard
```

## Múltiplos itens

O widget aceita **múltiplos itemids** e agrega todos no mesmo mapa.

A regra de agregação entre itens e amostras dentro do bucket é:

| Agregação | Regra aplicada no bucket |
| --- | --- |
| `Sum` | soma de todos os valores de todos os itens |
| `Average` | média de todos os valores de todos os itens |
| `Maximum` | maior valor entre todos os itens |
| `Count non-zero` | quantidade de amostras com valor maior que zero |

Na prática, cada célula representa o resultado consolidado do conjunto de itens selecionados para aquele **dia + hora**.

## Interações do widget

O heatmap agora possui comportamento interativo para facilitar análise no dashboard.

### Tooltip no hover

Ao passar o mouse sobre uma célula, o widget mostra um tooltip leve com:

- label da semana
- dia da semana
- hora
- valor agregado
- quantidade de itens agregados quando houver mais de um item selecionado

### Clique na célula

Ao clicar em uma célula com valor maior que zero, o widget abre uma página útil do Zabbix relacionada ao **item principal selecionado**.

Implementação atual:

- células com valor `0` não fazem nada
- células com valor `> 0` abrem o gráfico do primeiro item selecionado
- a lógica de clique ficou isolada no frontend para facilitar troca futura por drill-down mais específico

## Performance e arquitetura de dados

O widget foi refatorado para não pré-carregar várias semanas de uma vez.

### Lazy load por semana

- a primeira renderização carrega apenas a semana atual
- semanas anteriores são buscadas sob demanda ao clicar nas setas de navegacao
- semanas já carregadas ficam em memória no frontend durante a vida do widget

### Cache

O backend usa cache simples por arquivo temporário para evitar recalcular a mesma semana repetidamente.

Chave do cache:

- `itemids`
- `aggregation`
- `week_start_ts`

TTL atual:

- `180` segundos

### History vs Trends

A camada de obtenção de dados foi separada para facilitar evolução entre `history` e `trends`.

Comportamento atual:

- semanas mais recentes usam `history`
- semanas mais antigas podem usar `trends` para `Sum`, `Average` e `Maximum`
- `Count non-zero` continua em `history`, porque depende da contagem de amostras positivas
- se `trends` não estiver adequado para a consulta, o código faz fallback para `history`

## Requisitos e compatibilidade

Para usar o widget com previsibilidade:

- frontend do Zabbix com suporte a módulos de widget
- permissão para copiar o módulo para o diretório de módulos do frontend
- acesso a `Administration -> Modules` para habilitar o módulo
- itens numéricos compatíveis com o histórico do Zabbix
- cenário preferencial com itens `Numeric (unsigned)` ou `Numeric (float)`

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

## Adicionando o widget ao dashboard

1. Abra o dashboard desejado.
2. Clique em `Edit dashboard`.
3. Clique em `Add widget`.
4. Selecione `Item Heatmap`.
5. Escolha um ou mais itens.
6. Defina a agregação.
7. Salve o dashboard.

Campos principais:

- `Items`: um ou mais itens numéricos a serem consolidados no heatmap
- `Aggregation`: regra usada para calcular cada célula
- `Hour format`: permite escolher entre exibicao em `12-hour (AM/PM)`, `12-hour (no AM/PM)` ou `24-hour`
- `Show display title`: exibe um titulo interno no corpo do widget, independente do cabecalho padrao do dashboard
- `Display title`: texto do titulo interno; se ficar vazio, o widget usa o `Name` padrao do proprio widget
- `Show legend`: habilita uma linha adicional para contexto operacional, como lista de containers ou descricao do escopo observado
- `Legend / context`: texto livre mostrado abaixo do titulo interno quando a legenda estiver habilitada

### Layout e apresentacao visual

A apresentacao visual atual foi ajustada para ficar mais proxima de um painel de incident heatmap:

- celulas mais largas e mais altas para melhorar legibilidade em widgets de tamanho medio
- espacos regulares entre os cards de hora
- contraste mais forte entre fundo, labels e valores
- navegacao semanal integrada ao cabecalho do mapa
- suporte a exibicao de hora em 12h com AM/PM, 12h sem AM/PM ou 24h, conforme preferencia do dashboard
- paleta visual adaptada ao tema ativo do Zabbix, preservando o fundo padrao do dashboard
- titulo interno opcional e legenda opcional para contextualizar quais containers ou servicos estao sendo observados

![Widget Config](docs/images/widget-config.png)

## Pipeline recomendado para logs de containers

Este é o caso de uso mais comum do módulo.

A ideia é converter texto de log em um contador numérico por coleta. Depois disso, o heatmap passa a mostrar **quando** os erros acontecem com mais frequência.

### 1. Crie o item mestre de log

Crie ou reutilize um item que capture os logs do container.

Exemplos:

- logs de container Docker
- item de log via agent
- outra fonte textual já centralizada no Zabbix

![Item Log Source](docs/images/item-log-source.png)

### 2. Crie um item dependente numérico

Use um item dependente para derivar um valor numérico do log bruto.

Exemplo de configuração:

- `Type`: `Dependent item`
- `Name`: `Qtd ERROR - container`
- `Key`: `docker.container.errors.count`
- `Type of information`: `Numeric (unsigned)`
- `Master item`: item de logs do container

![Dependent Item Config](docs/images/dependent-item-config.png)

### 3. Adicione preprocessing para contar eventos

Na aba `Preprocessing`, adicione um passo do tipo `JavaScript` com uma lógica semelhante a esta:

```javascript
var matches = value.match(/ERROR/g);
return matches ? matches.length : 0;
```

Esse exemplo conta quantas vezes a string `ERROR` aparece no payload do log recebido na coleta.

Você pode adaptar o padrão para outros termos, como `WARN`, `timeout`, `exception` ou qualquer assinatura de erro do seu ambiente.

![Preprocessing Script](docs/images/preprocessing-script.png)

### 4. Valide o item derivado

No Zabbix, confira em:

```text
Monitoring -> Latest data
```

O item derivado deve retornar um valor numerico a cada coleta.

- `0` e normal quando nao ha correspondencias no payload recebido
- valores maiores que `0` indicam ocorrencias detectadas e agregadas pelo preprocessing

![Latest Data Values](docs/images/latest-data-values.png)

### 5. Use o item no widget

Depois que o item estiver gerando histórico numérico de forma consistente, selecione-o no `Item Heatmap` e escolha a agregação mais adequada.

### 6. Gere carga de teste, se necessário

Se estiver validando o fluxo em laboratório, você pode produzir eventos artificiais para popular o heatmap.

```bash
for i in {1..30}; do
  docker exec zabbix-log-generator sh -c 'echo "ERROR test $(date)" > /tmp/errpipe'
  sleep 1
done
```

## Como interpretar o heatmap

Cada célula representa:

```text
dia da semana + hora do dia
```

Exemplos:

- `Domingo 03:00`
- `Terça 14:00`
- `Sábado 22:00`

Leitura visual:

- tons mais neutros indicam menor intensidade
- tons mais quentes indicam maior concentração relativa na semana exibida
- o número dentro da célula mostra o valor agregado daquele bucket
- o tooltip no hover mostra semana, dia, faixa horaria e valor agregado
- as setas do cabeçalho permitem navegar entre semanas sob demanda

![Heatmap Week Navigation](docs/images/heatmap-week-navigation.png)

## Limitações atuais

Pontos importantes sobre o comportamento atual:

- o mapa continua consolidando múltiplos itens em uma única grade
- o clique abre o gráfico do item principal selecionado, não um drill-down específico por bucket
- a navegação permanece limitada a 12 semanas para preservar a proposta atual do widget
- `Count non-zero` depende de `history`, porque `trends` não fornece contagem exata de amostras positivas
- existe limite de consulta no carregamento do histórico, embora o lazy load reduza bastante a pressão da consulta

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

## Ideias de evolução

Possíveis próximos passos para o módulo:

- drill-down por célula com período exato do bucket clicado
- tooltip expandido com quebra por item
- filtros por período e granularidade configurável
- suporte visual comparativo entre itens em vez de consolidação única
- integração mais profunda com eventos e latest data

## Resumo

O `Item Heatmap` é um widget orientado a observabilidade operacional dentro do Zabbix. A força dele está em transformar histórico numérico em uma leitura visual simples sobre **quando** um comportamento acontece, inclusive quando há mais de um item contribuindo para o mesmo padrão semanal.

Com lazy load por semana, cache leve e interação por hover/clique, o módulo fica mais adequado para uso contínuo em dashboards de operação.

## Licença

MIT
