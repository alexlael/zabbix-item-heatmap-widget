# Zabbix Item Heatmap Widget

Heatmap semanal para itens numéricos do Zabbix com visualização por **dia da semana × hora**.

Este módulo foi criado para permitir visualizar padrões de ocorrência de eventos ao longo do tempo, especialmente útil para análise de logs de erro de containers.

---

# Objetivo do projeto

O objetivo deste widget é transformar eventos recorrentes em um mapa visual de densidade ao longo da semana.

Ele foi desenvolvido principalmente para o seguinte cenário:

Monitorar erros de containers Docker dentro do Zabbix e identificar:

- quais horários concentram mais erros
- quais dias da semana são mais problemáticos
- padrões recorrentes de falhas

O resultado é um heatmap semelhante a ferramentas de observabilidade modernas.

## Exemplo

| Dia/Hora | Volume de erros |
|---|---|
| Segunda 03:00 | baixo |
| Quinta 14:00 | médio |
| Sábado 16:00 | alto |

---

# Exemplo do widget

![Heatmap Example](docs/images/heatmap-example.png)

---

# Como o widget funciona

O widget não lê logs diretamente.

Ele trabalha com itens numéricos do Zabbix.

Portanto é necessário transformar logs em valores numéricos.

Fluxo de funcionamento:

```text
Logs do container
        ↓
Item de log no Zabbix
        ↓
Item dependente numérico (contador de erros)
        ↓
Item Heatmap Widget
```

O widget então agrupa os dados em:

```text
Dia da semana × Hora do dia
```

gerando a matriz do heatmap.

---

# Funcionalidades

- heatmap semanal por hora
- visualização por dia da semana
- navegação entre semanas
- agregação de dados
- layout em cards
- escala de cores baseada em intensidade

---

# Estrutura do heatmap

Cada célula representa:

```text
1 hora específica de um dia específico
```

Exemplo:

```text
Segunda 14h
Terça 03h
Sábado 18h
```

O valor exibido depende da agregação escolhida:

| Aggregation | Descrição |
|---|---|
| Sum | Soma dos valores da hora |
| Average | Média dos valores |
| Max | Maior valor |
| Count non-zero | Quantidade de ocorrências |

---

# Instalação do módulo

## 1 — Copiar o módulo

Copie a pasta do projeto para o diretório de módulos do frontend do Zabbix.

Exemplo usando Docker:

```bash
docker cp zabbix-item-heatmap-widget zabbix-web:/usr/share/zabbix/modules/
```

## 2 — Escanear módulos

No Zabbix:

```text
Administration → Modules
```

Clique em:

```text
Scan directory
```

O módulo **Item Heatmap** aparecerá na lista.

## 3 — Habilitar o módulo

Ainda em:

```text
Administration → Modules
```

Clique em **Enable**.

---

# Adicionando o widget ao dashboard

1. Abra um Dashboard
2. Clique em **Edit dashboard**
3. Clique em **Add widget**
4. Escolha **Item Heatmap**

Configure:

```text
Item → item numérico
Aggregation → modo de agregação
```

![Widget Config](docs/images/widget-config.png)

---

# Transformando logs de container em valores numéricos

Este é o passo mais importante para usar o heatmap.

O Zabbix precisa de um valor numérico.

Então precisamos transformar logs em contadores.

---

# Passo 1 — Criar item de logs

Primeiro você precisa de um item que receba os logs do container.

Exemplo:

```text
docker logs
container logs
agent log item
```

Print sugerido:

```text
docs/images/item-log-source.png
```

Tire o print mostrando:

- nome do item
- key
- tipo do item

![Item Log Source](docs/images/item-log-source.png)

---

# Passo 2 — Criar item dependente

Crie um novo item:

```text
Type: Dependent item
```

Configuração exemplo:

**Name**

```text
Qtd ERROR - container
```

**Key**

```text
docker.container.errors.count
```

**Type of information**

```text
Numeric (unsigned)
```

**Master item**

```text
item de logs do container
```

![Dependent Item Config](docs/images/dependent-item-config.png)

---

# Passo 3 — Adicionar preprocessing

Na aba **Preprocessing** adicione um passo do tipo:

```text
JavaScript
```

Script:

```javascript
var matches = value.match(/ERROR/g);
return matches ? matches.length : 0;
```

Este script conta quantas vezes a palavra:

```text
ERROR
```

aparece nos logs.

![Preprocessing Script](docs/images/preprocessing-script.png)

---

# Passo 4 — Validar item numérico

Depois de criado, verifique:

```text
Monitoring → Latest data
```

O item deve retornar valores como:

```text
0
2
15
37
```

![Latest Data Values](docs/images/latest-data-values.png)

---

# Passo 5 — Gerar erros de teste (opcional)

Se estiver testando em laboratório, você pode gerar erros manualmente.

Exemplo:

```bash
for i in {1..30}; do
  docker exec zabbix-log-generator sh -c 'echo "ERROR test $(date)" > /tmp/errpipe'
  sleep 1
done
```

Depois confira:

```bash
docker logs zabbix-log-generator
```

![Container Error Test](docs/images/container-error-test.png)

---

# Usando o heatmap

Cada célula representa:

```text
dia da semana + hora
```

As cores indicam intensidade.

| Cor | Significado |
|---|---|
| verde | baixo volume |
| amarelo | médio |
| laranja | alto |
| vermelho | muito alto |

---

# Navegação entre semanas

O widget carrega várias semanas e permite navegar usando:

```text
← semana anterior
→ semana seguinte
```

![Heatmap Week Navigation](docs/images/heatmap-week-navigation.png)

---

# Estrutura do projeto

```text
zabbix-item-heatmap-widget
│
├── actions
│   ├── WidgetEdit.php
│   └── WidgetView.php
│
├── assets
│   ├── css
│   │   └── widget.css
│   └── js
│       └── class.widget.js
│
├── docs
│   └── images
│
├── includes
│   └── WidgetForm.php
│
├── views
│   ├── widget.edit.php
│   └── widget.view.php
│
├── manifest.json
├── Module.php
├── Widget.php
└── README.md
```

---

# Possíveis melhorias futuras

- clique em célula para abrir item
- integração com eventos
- suporte a múltiplos itens
- filtro por período
- integração com time selector do dashboard
- tooltip com detalhes

---

# Licença

MIT