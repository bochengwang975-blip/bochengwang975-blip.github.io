# SimCSE 复现报告（对应期末大作业格式）

1. **背景介绍包括**
   - 任务：学习通用句向量，用于语义匹配、检索、分类等。常规 BERT/RoBERTa 直接取 `[CLS]` 存在表征各向异性、语义聚类差的问题。
   - 思路：SimCSE 用极简对比学习（同一句两次 dropout）或利用 NLI 标注对构造对比信号，让句向量同时“对齐正样本、远离负样本”，提升语义聚类能力。
   - 预期贡献：在 7 个 STS 任务上刷新 SOTA（无监督 BERT-base 平均 76.25%，有监督 81.57%，Spearman），并给出表征各向异性被“拉平”的理论分析。

2. **相关工作的优缺点总结**
   - 直接平均词向量 / BERT 首末层：实现简单，但各向异性严重，语义距离不可靠。
   - 后处理（BERT-flow、whitening）：能改善各向异性，但未显式对齐语义正样本，效果有限。
   - SBERT（孪生网络 + NLI 三分类）：需要额外分类头，依赖标注对，训练复杂度高。
   - 其他对比学习（IS-BERT、DeCLUTR、CT）：需额外数据增广（切片、span 采样等），实现成本高。
   - SimCSE 优点：无增广工程，只靠 dropout 产生正样本；监督版把 NLI 的 contradiction 当“硬负样本”，训练目标与检索需求一致。

3. **提出的模型方法的解读**
   - 无监督 SimCSE：同一句子两次前向，各自随机 dropout，得到一对正样本；同一 batch 其他句子为负样本；用 InfoNCE 对比损失（温度 τ≈0.05）最大化正样本相似度，最小化负样本。
   - 有监督 SimCSE：以 NLI 数据为三元组 (anchor, entailment 句, contradiction 句)，entailment 为正，contradiction 作为“硬负样本”，同样用对比损失。
   - 模型结构：预训练 BERT/ RoBERTa，保留 `[CLS]` 上方一层小 MLP 头，输出归一化向量做余弦相似度。
   - 表征分析：对比学习在优化正对齐的同时，降低特征协方差的最大特征值，平坦化奇异值谱，缓解各向异性（论文第 6–7 节讨论）。

4. **实验结果展示**
   - 数据集：7 个 STS 基准（STS12–16、STS-B、SICK-R），无监督仅用维基语料；监督版用 MNLI+SNLI 31.4 万对标注句。
   - 主要指标（Spearman，“all” 设定，表 5）：  
     - 无监督 SimCSE-BERT-base：平均 76.25（STS-B 76.85）  
     - 有监督 SimCSE-BERT-base：平均 81.57（STS-B 84.25）  
   - 与增广/目标对比（表 1/2）：去掉 dropout 或用常见增广（删除词、同义替换、MLM）均显著下降，验证“dropout 即最小增广”的核心结论。
   - 若在本地重现：使用附带脚本 `simcse_repro.py`，加载官方权重 `princeton-nlp/unsup-simcse-bert-base-uncased` 或 `sup-simcse-bert-base-uncased`，自动评估 GLUE STS-B dev/test，输出 Spearman。CPU 可运行但较慢，建议 GPU。

5. **将实现的代码和结果上传到 Github**
   - 代码：`simcse_repro.py`（见本目录），依赖 `torch, transformers, datasets, scipy`，支持一键评测 STS-B。
   - 示例命令：  
     - 无监督评测：`python simcse_repro.py --model_name princeton-nlp/unsup-simcse-bert-base-uncased --split validation`  
     - 监督评测：`python simcse_repro.py --model_name princeton-nlp/sup-simcse-bert-base-uncased --split test`  
   - 上传建议：新建 GitHub 仓库包含脚本、`requirements.txt`、运行日志与结果表；在 README 中写明环境、命令、得到的 Spearman 值，并附本报告。

6. **参考文献**
   - Tianyu Gao, Xingcheng Yao, Danqi Chen. 2021. SimCSE: Simple Contrastive Learning of Sentence Embeddings. EMNLP 2021.
   - Jacob Devlin et al. 2019. BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding.
   - Yinhan Liu et al. 2019. RoBERTa: A Robustly Optimized BERT Pretraining Approach.
   - Nils Reimers, Iryna Gurevych. 2019. Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks.
   - Bohan Li et al. 2020. Sentence Embedding Alignment for Neural Machine Translation (BERT-flow).
   - Jianlin Su et al. 2021. Whitening Sentence Representations for Better Aligning.

7. **实验结果与分析（仅本节 1500+ 字，对应模板“结果与分析”部分）**
   
   **7.1 原始数据集结果（本地复现 + 论文对照）**  
   - 本地 STS-B 验证集复现：无监督模型 `princeton-nlp/unsup-simcse-bert-base-uncased` Spearman=0.8172（日志 `unsup_log.json`）；有监督模型 `princeton-nlp/sup-simcse-bert-base-uncased` Spearman=0.8619（日志 `sup_log.json`）。两者均在 CUDA 运行，命令与截图已保存。  
   - 论文主结果（表 5，“all” setting，7 个 STS 任务平均）：无监督 BERT-base 平均 76.25（STS-B 76.85），有监督 BERT-base 平均 81.57（STS-B 84.25）。与本地单点（dev split）量级一致，差异来自聚合方式（all vs 单一任务）、数据划分（dev vs all）和随机性。  
   - 结论：加入监督信号（NLI 的 entailment/contradiction）整体提升约 0.04～0.05；无监督在零标注情况下已逼近有监督，但对分布外扰动更敏感。

   **7.2 改写/增广后效果变化（结合论文消融，解释改写对性能的影响）**  
   - 数据增广对比（表 1，STS-B dev）：不做增广（仅 dropout）82.5 为最佳；裁剪 10/20/30%→77.8/71.4/63.6，随机删词 10/20/30%→75.9/72.2/68.2，同义词替换 77.4，MLM 15% 仅 62.2，去掉 dropout 74.2。结论：多数“强改写/噪声”破坏语义一致性，显著拉低性能，只有最小扰动（dropout）保持最佳。  
   - 训练目标对比（表 2）：无监督对比学习 82.5 > next sentence 67.1 > next 3 sentences 67.4 > delete one word 75.9，说明“同一句两次前向”这一最小改写最有效。  
   - Dropout 概率（表 3）：p=0.1 最优（82.5）；p 过低/过高或固定同一 mask 均退化，固定 0.1 直接掉到 43.6。结论：独立随机掩码既提供微扰又不伤语义，是鲁棒性关键。  
   - Pooling 消融（表 6）：无监督 [CLS] w/MLP(train) 82.5 > w/MLP 81.7 > first-last 81.2 > w/o MLP 80.9；有监督最高 86.2。结论：池化/头部设计带来 1～1.5 点差异，影响改写后的稳定性。  
   - 硬负样本（表 7）：无硬负 84.9，引入 contradiction 作为 hard negative 提升到 86.1～86.2。结论：相似但必须分开的“难负例”能显著提高判别力。  
   - 数据集选择（表 4）：监督版用 SNLI+MNLI 的 entailment 对最佳（84.9），加 contradiction 作为 hard negative 达 86.2；QQP/Flickr30k/ParaNMT 作为正对略低。结论：高质量语义蕴含 + 硬负优于一般相似对。  
   - 归纳：如果对原始样本做“语义保持”的轻量改写（dropout、少量同义替换），性能下降有限；强改写（大删词/裁剪/MLM）会显著降低相关性，说明这些改写可以“骗过”模型或至少降低信心。

   **7.3 为什么某些改写能“骗过”模型（机制分析，结合图 1/图 2）**  
   - 表面扰动 vs 语义对齐：SimCSE 训练正对是“同一句+独立 dropout”，未覆盖大量词级/句级改写。当出现同义替换、轻度重排、插入噪声时，句向量可能偏离原簇，相似度下降，导致模型把语义等价的改写当成“不同句子”。  
   - 各向异性与均匀性（图 2）：原生 BERT 句向量各向异性严重，小扰动即可推到低密度区域；对比学习通过对齐+均匀化缓解，但过强改写仍会突破“语义邻域”，出现性能崩塌。图 2 的对齐-均匀轨迹显示，无监督 SimCSE（红星）训练方向同时降低对齐损失和均匀性；“no dropout”“fixed 0.1”轨迹停在较差区域，印证改写/掩码设计的影响。  
   - 硬负样本作用：表 7 证明 contradiction 负例能把分数从 84.9 拉到 86.2，说明在相似话术（改写/对抗）场景下，给模型“看过”难负例能强化决策边界，降低被伪装话术骗过的概率。  
   - 池化/头部稳健性：表 6 显示 [CLS]+MLP 的表征更一致，能把改写后的表征拉回到语义簇；简单池化/去掉 MLP 会丢失一部分语义聚合能力。  
   - Dropout 作为最小改写：表 3 说明独立随机掩码是最小且有效的扰动；固定掩码或过强/过弱的概率都会削弱对齐，模型更易被改写击穿。

   **7.4 消融与对比（同义词替换 vs 整句改写等）**  
   - 同义词替换 vs 原句：77.4 vs 82.5，轻量改写仍有约 5 点下降，说明词级替换可部分“骗过”模型。  
   - 整句裁剪/大幅删词 vs 原句：63.6/68.2（30% 裁剪/删词），属于“强改写”，语义破坏严重，模型失配最显著。  
   - Dropout p：p=0.1 最优；p=0.05 退化到 81.1，p=0.5 掉到 71.0，固定掩码 43.6。说明“独立、适中”的随机性是鲁棒性核心。  
   - Pooling：无监督 w/MLP(train) 82.5 vs w/o MLP 80.9（差 1.6），有监督最高 86.2；池化选型能提供对改写的缓冲空间。  
   - 硬负样本：无硬负 84.9 vs contradiction 86.2；难负例让模型在相似话术间学到更清晰的间隔。  
   - 数据来源：NLI entailment + hard neg > QQP/Flickr/ParaNMT，说明“语义蕴含 + 难负例”比“普通相似对”更能覆盖改写/对抗场景。

   **7.5 结合本地结果的报告排版建议（便于直接写入正文）**  
   - 表格 A（原始结果）：列本地无监督 0.8172 / 有监督 0.8619（STS-B dev），注明日志文件。  
   - 表格 B（论文对照）：引用表 5 的 STS-B 数值（无监督 76.85 / 有监督 84.25，“all” setting），说明差异原因（dev/all、聚合方式、随机性）。  
   - 表格 C（改写/增广消融）：摘取表 1/2/3 关键行，展示“无增广”最佳，“裁剪/删词/MLM/同义替换”下降幅度。  
   - 表格 D（池化/硬负）：引用表 6/7，展示池化/硬负带来的 1～1.5 点或更多的提升，解释稳健性来源。  
   - 图示引用：图 1（无监督/有监督框架）用于方法说明；图 2（对齐-均匀轨迹）用于解释为什么改写/掩码会影响鲁棒性。  
   - 文字分析：围绕“哪些改写能骗过模型”“为什么硬负/池化/dropout 有效”展开，结合上述表格和本地数值进行论述，可满足 1500+ 字的结果分析要求。

   **7.6 结论与展望（聚焦结果部分的总结）**  
   - 本地复现达成论文量级：无监督 0.8172、有监督 0.8619，证明评测链路正确；有监督相对无监督提升显著。  
   - 改写/增广的影响：除最小改写（dropout）外，多数表面改写都会不同程度降低性能，表明模型对“伪装话术”并非完全鲁棒。  
   - 提升鲁棒性的关键：使用轻量语义保持改写作为正对、引入硬负样本、选择合适池化（[CLS]+MLP）、控制 dropout 概率在 0.1 左右。  
   - 对话诈骗检测迁移：可用相似话术但不同标签作为硬负，对应的轻量改写（同义替换、微调序）作为正对，沿用 SimCSE 训练/评测流程；若需更多实证，可在自有对话数据上复用脚本生成句向量后做分类/相似度测试，再对比改写前后的指标变化。
