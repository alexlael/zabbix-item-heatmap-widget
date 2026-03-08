# Zabbix Item Heatmap Widget

Heatmap semanal para itens numéricos do Zabbix com visualização por **dia da semana × hora**.

Este módulo foi criado para permitir visualizar **padrões de ocorrência de eventos ao longo do tempo**, especialmente útil para análise de **logs de erro de containers**.

---

# Objetivo do projeto

O objetivo deste widget é transformar eventos recorrentes em um **mapa visual de densidade ao longo da semana**.

Ele foi desenvolvido principalmente para o seguinte cenário:

Monitorar **erros de containers Docker** dentro do Zabbix e identificar:

- quais horários concentram mais erros
- quais dias da semana são mais problemáticos
- padrões recorrentes de falhas

O resultado é um **heatmap semelhante a ferramentas de observabilidade modernas**.

Exemplo:

| Dia/Hora | Volume de erros |
|--------|--------|
| Segunda 03:00 | baixo |
| Quinta 14:00 | médio |
| Sábado 16:00 | alto |

---

# Exemplo do widget

![Heatmap Example](docs/images/heatmap-example.png)

---

# Como o widget funciona

O widget **não lê logs diretamente**.

Ele trabalha com **itens numéricos do Zabbix**.

Portanto é necessário transformar logs em valores numéricos.

Fluxo de funcionamento:

```
Logs do container
        ↓
Item de log no Zabbix
        ↓
Item dependente numérico (contador de erros)
        ↓
Item Heatmap Widget
```

O widget então agrupa os dados em:

```
Dia da semana × Hora do dia
```

gerando a matriz do heatmap.

---

# Funcionalidades

- heatmap semanal por **hora**
- visualização por **dia da semana**
- navegação entre semanas
- agregação de dados
- layout em cards
- escala de cores baseada em intensidade

---

# Estrutura do heatmap

Cada célula representa:

```
1 hora específica de um dia específico
```

Exemplo:

```
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

---

## 2 — Escanear módulos

No Zabbix:

```
Administration → Modules
```

Clique em:

```
Scan directory
```

O módulo **Item Heatmap** aparecerá na lista.

---

## 3 — Habilitar o módulo

Ainda em:

```
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

```
Item → item numérico
Aggregation → modo de agregação
```

---

# Transformando logs de container em valores numéricos

Este é o passo mais importante para usar o heatmap.

O Zabbix precisa de **um valor numérico**.

Então precisamos transformar logs em contadores.

---

# Passo 1 — Criar item de logs

Primeiro você precisa de um item que receba os logs do container.

Exemplo:

```
docker logs
container logs
agent log item
```

Print sugerido:

```
docs/images/item-log-source.png
```

Tire o print mostrando:

- nome do item
- key
- tipo do item

---

# Passo 2 — Criar item dependente

Crie um novo item:

```
Type: Dependent item
```

Configuração exemplo:

Name

```
Qtd ERROR - container
```

Key

```
docker.container.errors.count
```

Type of information

```
Numeric (unsigned)
```

Master item

```
item de logs do container
```

Print sugerido:

```
docs/images/dependent-item-config.png
```

---

# Passo 3 — Adicionar preprocessing

Na aba **Preprocessing** adicione um passo do tipo:

```
JavaScript
```

Script:

```javascript
var matches = value.match(/ERROR/g);
return matches ? matches.length : 0;
```

Este script conta quantas vezes a palavra:

```
ERROR
```

aparece nos logs.

Print sugerido:

```
docs/images/preprocessing-script.png
```

---

# Passo 4 — Validar item numérico

Depois de criado, verifique:

```
Monitoring → Latest data
```

O item deve retornar valores como:

```
0
2
15
37
```

Print sugerido:

```
docs/images/latest-data-values.png
```

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

Print sugerido:

```
docs/images/container-error-test.png
```

---

# Usando o heatmap

Cada célula representa:

```
dia da semana + hora
```

As cores indicam intensidade.

| Cor | Significado |
|----|----|
| verde | baixo volume |
| amarelo | médio |
| laranja | alto |
| vermelho | muito alto |

---

# Navegação entre semanas

O widget carrega várias semanas e permite navegar usando:

```
← semana anterior
→ semana seguinte
```

Print sugerido:

```
docs/images/heatmap-week-navigation.png
```

---

# Estrutura do projeto

```
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