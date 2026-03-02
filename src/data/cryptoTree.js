export const cryptoTreeData = {
  fields: [
    {
      id: "defi-protocols",
      name: "DeFi Protocols",
      description: "Decentralized Finance protocols and platforms",
      tags: ["DeFi", "Finance", "Protocols"],
      categories: [
        {
          id: "lending-borrowing",
          name: "Lending & Borrowing",
          description: "Protocols for lending and borrowing crypto assets",
          tags: ["Lending", "Borrowing", "DeFi"],
          nodes: [
            {
              id: "aave",
              name: "Aave",
              description: "Leading decentralized lending protocol",
              tags: ["Aave", "Lending", "Ethereum"]
            },
            {
              id: "compound",
              name: "Compound",
              description: "Algorithmic money market protocol",
              tags: ["Compound", "Lending", "Ethereum"]
            }
          ]
        }
      ]
    },
    {
      id: "layer2-solutions",
      name: "Layer 2 Solutions",
      description: "Scaling solutions for blockchain networks",
      tags: ["Layer2", "Scaling", "Ethereum"],
      categories: [
        {
          id: "optimistic-rollups",
          name: "Optimistic Rollups",
          description: "Optimistic rollup scaling solutions",
          tags: ["Optimistic", "Rollups", "Scaling"],
          nodes: [
            {
              id: "arbitrum",
              name: "Arbitrum",
              description: "Leading optimistic rollup solution",
              tags: ["Arbitrum", "Rollups", "Ethereum"]
            }
          ]
        }
      ]
    }
  ]
}