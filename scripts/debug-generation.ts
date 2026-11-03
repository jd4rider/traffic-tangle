import { generateLevel, generationDebug, generationLog, generationRejections } from '../src/core/generator'

const [world, index] = process.argv.slice(2).map(Number)
const level = generateLevel(world, index)
console.log('generated:', level ? level.id : 'none')
console.log('last rejections:', generationLog.slice(-4))
console.log('rejection counts:', generationRejections)
console.log(generationDebug)
