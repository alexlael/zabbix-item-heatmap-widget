# Item Heatmap Widget for Zabbix

Módulo de dashboard para Zabbix que transforma séries históricas em um **heatmap semanal por dia da semana x hora**, facilitando a identificação de picos, recorrência e janelas de maior ocorrência.

Ele foi pensado para cenários em que olhar apenas para gráfico ou tabela não responde rapidamente perguntas como:

- Em quais horários os erros se concentram?
- Existe recorrência por dia da semana?
- O problema acontece em janelas específicas de operação?
- Uma rotina, job ou integração está degradando sempre nos mesmos períodos?

![Heatmap Example](docs/images/heatmap-example.png)

## Visão geral

| Item | Valor |
| --- | --- |
| Tipo | Widget de dashboard para Zabbix |
| Nome exibido | `Item Heatmap` |
| Versão do módulo | `1.0.0` |
| Atualização automática | `60s` |
| Granularidade | 1 hora |
| Janela carregada | últimas 12 semanas |
| Agregação disponível | `Sum`, `Average`, `Maximum`, `Count non-zero` |

## Quando usar

Este widget é útil quando o dado relevante já está dentro do Zabbix como série numérica e você quer enxergar **distribuição temporal**, não apenas tendência.

Exemplos práticos:

- contagem de erros em logs de containers
- falhas de integrações recorrentes
- picos de retries, exceções ou timeouts
- bursts de filas ou jobs agendados
- qualquer item numérico que faça sentido analisar por recorrência semanal

## O problema que o módulo resolve

O Zabbix já oferece histórico, latest data e gráficos. O ponto deste widget é outro: condensar o histórico em uma matriz visual de **7 dias x 24 horas** para mostrar rapidamente onde a concentração de eventos é maior.

Em vez de navegar por listas de valores ou séries longas, o operador vê:

- quais dias são mais problemáticos
- quais horas concentram maior volume
- se existe padrão operacional ou sazonalidade semanal
- se a carga está espalhada ou concentrada em poucos intervalos

## Como o widget funciona

O módulo **não lê logs diretamente**. Ele consome itens históricos do Zabbix e monta uma grade semanal agregada por hora.

Fluxo recomendado:

```text
Fonte de dados
    -> item no Zabbix
    -> item numérico derivado
    -> Item Heatmap Widget
```

Cenário mais comum para logs:

```text
Log do container
    -> item mestre de log
    -> item dependente numérico (contador)
    -> heatmap no dashboard
```

## Comportamento técnico atual

O widget faz o seguinte processamento:

1. Carrega o histórico dos itens selecionados.
2. Agrupa cada amostra por semana, dia da semana e hora.
3. Aplica a agregação configurada em cada célula.
4. Renderiza uma matriz semanal em canvas.
5. Permite navegar entre as 12 semanas carregadas.

Detalhes importantes da implementação atual:

- A semana é organizada de **domingo a sábado**.
- Cada célula representa **uma hora específica de um dia específico**.
- Se mais de um item for selecionado, os valores são **consolidados na mesma matriz**.
- A escala de cores é **relativa ao maior valor da semana exibida**.
- O backend carrega uma janela fixa de **12 semanas**.

## Agregações disponíveis

| Agregação | O que representa |
| --- | --- |
| `Sum` | Soma dos valores encontrados na célula |
| `Average` | Média das amostras da célula |
| `Maximum` | Maior valor encontrado na célula |
| `Count non-zero` | Quantidade de amostras com valor maior que zero |

`Count non-zero` conta **amostras não zeradas**, o que é ideal para cenários em que cada coleta representa a presença ou ausência de um evento.

## Requisitos e escopo atual

Para usar o módulo com previsibilidade, considere o escopo atual da implementação:

- frontend do Zabbix com suporte a módulos de widget
- permissão para copiar o módulo para o diretório de módulos do frontend
- acesso a `Administration -> Modules` para habilitar o módulo
- itens com histórico compatível com **`Numeric (unsigned)`**, que é o cenário suportado pela consulta atual do histórico
- dados com volume coerente com a janela do widget

Observação importante: embora o widget esteja exposto no dashboard com suporte visual ao time selector, a consulta atual do backend trabalha com uma janela fixa das **últimas 12 semanas**, e não com um intervalo arbitrário definido pelo usuário.

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
5. Escolha os itens e a agregação.
6. Salve o dashboard.

Campos principais:

- `Items`: um ou mais itens numéricos a serem consolidados no heatmap
- `Aggregation`: regra de cálculo aplicada em cada célula da matriz

![Widget Config](docs/images/widget-config.png)

## Pipeline recomendado para logs de containers

Este é o caso de uso mais natural para o módulo e o que melhor demonstra sua proposta de valor.

A ideia é converter texto de log em um contador numérico por coleta. O heatmap então passa a mostrar **quando** os erros acontecem com mais frequência.

### 1. Crie o item mestre de log

Crie ou reutilize um item que capture os logs do container.

Exemplo de origem:

- logs de container Docker
- item de log via agent
- outra fonte textual já centralizada no Zabbix

![Item Log Source](docs/images/item-log-source.png)

### 2. Crie um item dependente numérico

Use um item dependente para derivar um valor numérico a partir do log bruto.

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

O item derivado deve começar a retornar valores como:

```text
0
2
15
37
```

![Latest Data Values](docs/images/latest-data-values.png)

### 5. Use o item no widget

Depois que o item estiver gerando histórico numérico de forma consistente, selecione-o no `Item Heatmap` e escolha a agregação que melhor representa o seu caso.

### 6. Gere carga de teste, se necessário

Se estiver validando o fluxo em laboratório, você pode produzir eventos artificiais para popular o heatmap.

```bash
for i in {1..30}; do
  docker exec zabbix-log-generator sh -c 'echo "ERROR test $(date)" > /tmp/errpipe'
  sleep 1
done
```

![Container Error Test](docs/images/container-error-test.png)

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

- tons mais frios/escuros indicam menor intensidade
- tons mais quentes indicam maior concentração relativa na semana atual
- o número desenhado na célula mostra o valor agregado daquela hora
- as setas do cabeçalho permitem navegar entre as semanas carregadas

![Heatmap Week Navigation](docs/images/heatmap-week-navigation.png)

## Limitações atuais

Estas limitações valem a pena constar no README porque impactam expectativa de uso em produção:

- o widget consulta atualmente histórico do tipo `Numeric (unsigned)`
- a janela analisada é fixa nas **últimas 12 semanas**
- a granularidade é fixa em **1 hora**
- a semana começa em **domingo**
- a escala de cores é calculada por semana, então a comparação visual entre semanas diferentes é relativa
- existe um limite de consulta de histórico de `100000` registros por carregamento
- ainda não há drill-down, tooltip detalhado nem clique por célula
- itens múltiplos são agregados juntos; o widget não separa uma grade por item

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

- drill-down por célula para abrir item, latest data ou eventos relacionados
- tooltip com metadados do bucket selecionado
- filtros por período e granularidade configurável
- separação visual por item quando múltiplos itens forem selecionados
- melhor integração com o time selector do dashboard
- suporte expandido a outros tipos de item numérico

## Resumo

O `Item Heatmap` é um widget orientado a observabilidade operacional dentro do Zabbix. A força dele está em transformar histórico numérico em uma leitura visual simples sobre **quando** um comportamento acontece, o que é especialmente útil para erros recorrentes, ruído em logs e padrões semanais de falha.

Se o seu dado consegue ser convertido em contagem, frequência ou intensidade por coleta, este módulo passa a ser uma camada visual bastante eficaz para análise rápida no dashboard.

## Licença

MIT
