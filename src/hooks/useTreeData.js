import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { TreeSchema } from '../data/schema'

export const useTreeData = () => {
  const { tree, treeLoading, treeError, setTree, setTreeLoading, setTreeError } = useAppStore()

  useEffect(() => {
    const loadTree = async () => {
      setTreeLoading(true)
      
      try {
        // Fix Problem 3: Use API endpoint that already resolves descriptions
        const response = await fetch('/api/tree')
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        
        const data = await response.json()
        
        // Validate and set tree data
        const validated = TreeSchema.parse(data)
        console.log('Tree loaded successfully with', validated.fields?.length || 0, 'fields')
        
        // Fix Problem 5: Check data structure compatibility
        if (!validated.fields || !Array.isArray(validated.fields)) {
          console.warn('Invalid tree structure received:', validated)
          throw new Error('Invalid tree data structure')
        }
        
        // Count descriptions for debugging
        let descriptionCount = 0
        let nodeCount = 0
        let missingDescriptions = []
        
        const countDescriptions = (nodes) => {
          if (!Array.isArray(nodes)) return
          for (const node of nodes) {
            nodeCount++
            if (node.description) {
              descriptionCount++
            } else if (node.descriptionRef) {
              missingDescriptions.push({ id: node.id, ref: node.descriptionRef })
            }
            const childArrays = [node.categories, node.subcategories, node.nodes, node.subnodes, node.leafnodes, node.children]
            for (const children of childArrays) {
              if (children) countDescriptions(children)
            }
          }
        }
        
        countDescriptions(validated.fields)
        console.log(`Descriptions: ${descriptionCount}/${nodeCount} nodes have descriptions`)
        
        // Fix Problem 3: Remove client-side resolution since server handles it
        if (missingDescriptions.length > 0) {
          console.warn('Some descriptions still unresolved (server should handle this):', missingDescriptions.slice(0, 5))
        }
        
        setTree(validated)
        
      } catch (error) {
        console.error('Tree loading failed:', error)
        setTreeError(error.message)
      } finally {
        setTreeLoading(false)
      }
    }

    if (!tree) loadTree()
  }, [tree, setTree, setTreeLoading, setTreeError])

  return { tree, loading: treeLoading, error: treeError }
}