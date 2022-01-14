import {
    StringLiteral,
    stringLiteral,
    unaryExpression,
    numericLiteral,
    isImportSpecifier,
    importDeclaration,
    importDefaultSpecifier,
    ImportSpecifier,
    ImportDeclaration
} from '@babel/types';
import { isReactClass, isStatelessComponent } from './util';
import { Options } from './types';

export default () => {
    const defaultOptions: Options = {
        imports: {
            ignoreLibraries: ['react'],
            ignoreFilenames: '',
            remove: true,
            customImports: [],
        },
        styles: {
            ignoreFilenames: '',
            remove: true,
        },
        propTypes: {
            ignoreFilenames: '',
            remove: true,
            onlyProduction: true,
        }
    };
    let globalOptions: Options = null;
    const STYLE_NAME_SPACE: string = 'StyleSheet';
    const STYLE_CREATE_METHOD: string = 'create';

    function remove(path): void {
        if (path.parentPath.type === 'ConditionalExpression') {
            path.replaceWith(unaryExpression('void', numericLiteral(0)));
        } else {
            path.remove();
        }
    }

    function isIgnore(scope, regex: RegExp): boolean {
        const filename: string = scope.hub?.file?.opts?.filename;
        if (!filename) {
            return true;
        }
        if (!regex) {
            return false;
        }
        return (regex as RegExp).test(filename);
    }

    function isProptypesRemove(path): boolean {
        const { remove, ignoreFilenames, onlyProduction } = globalOptions.propTypes;
        if (!remove || isIgnore(path.scope, ignoreFilenames as RegExp)) {
            return false;
        }
        if (onlyProduction) {
            return process.env.NODE_ENV === "production";
        }
        return true;
    }

    const collectNestedObjects = {
        ObjectExpression(path, options) {
            const { identifier, styles } = options;
            const parentPath = path.parentPath;
            if (parentPath.key !== 'init') {
                const propertyKeyName = parentPath.node.key?.name;
                if (!propertyKeyName) return;
                const propertyKey = `${identifier} ${propertyKeyName}`;
                if (!styles.has(propertyKey)) {
                    remove(parentPath);
                }
            }
        },
    };

    function normalizeOptions(options): void {
        const { imports, styles, propTypes } = options;
        if (!imports.customImports) imports.customImports = [];
        if (!Array.isArray(imports.customImports)) {
            imports.customImports = [imports.customImports];
        }
        if (!imports.ignoreLibraries) imports.ignoreLibraries = ['react'];
        if (!Array.isArray(imports.ignoreLibraries)) {
            imports.ignoreLibraries = [imports.ignoreLibraries];
        }
        imports.ignoreFilenames = imports.ignoreFilenames ? new RegExp(imports.ignoreFilenames.join('|'), 'i') : '';
        styles.ignoreFilenames = styles.ignoreFilenames ? new RegExp(styles.ignoreFilenames.join('|'), 'i') : '';
        propTypes.ignoreFilenames = propTypes.ignoreFilenames ? new RegExp(propTypes.ignoreFilenames.join('|'), 'i') : '';
    }

    return {
        name: 'rn-remove-unused-code',
        visitor: {
            Program(programPath, state) {
                if (!globalOptions) {
                    const options: Options = state.opts;
                    globalOptions = Object.assign({}, defaultOptions, options) as Options;
                    normalizeOptions(globalOptions);
                }
            },
            ImportDeclaration(path) {
                const { node, scope } = path;
                const specifiers: ImportSpecifier[] = node.specifiers;
                const sourceValue: string = node.source.value;
                const imports: Record<string, any> = globalOptions.imports;
                if (isIgnore(path.scope, globalOptions.imports.ignoreFilenames as RegExp)) return;
                if (imports.remove) {
                    for (let i = specifiers.length - 1; i >= 0; i--) {
                        const name: string = specifiers[i].local.name;
                        const binding = scope.getBinding(name);
                        if (binding?.referencePaths?.length === 0 && !imports.ignoreLibraries.includes(sourceValue)) {
                            remove(binding.path);
                        }
                        if (specifiers.length === 0) {
                            remove(path);
                        }
                    }
                }
                if (imports.customImports.length) {
                    const customImport = imports.customImports.find(imports => imports.libraryName === sourceValue);
                    if (customImport && isImportSpecifier(specifiers[0])) {
                        const newImports: ImportDeclaration[] = specifiers.map(specifier => {
                            const localName: string = specifier.local.name;
                            const customUrl: string = customImport.customMapping?.[localName] ?? `${customImport.libraryDirectory ?? 'lib'}/${localName}`;
                            return (
                                importDeclaration([importDefaultSpecifier(specifier.local)],
                                    stringLiteral(`${customImport.libraryName}/${customUrl}`))
                            )
                        });
                        path.replaceWithMultiple(newImports);
                    }
                }
            },
            ClassProperty(path) {
                if (!isProptypesRemove(path)) return;
                const { node, scope } = path;
                if (node.key?.name === 'propTypes') {
                    const pathClassDeclaration = scope.path;
                    if (isReactClass(pathClassDeclaration.get('superClass'), scope)) {
                        remove(path);
                    }
                }
            },
            ObjectProperty(path) {
                if (!isProptypesRemove(path)) return;
                if (!path.node.computed && path.node.key.name === 'propTypes') {
                    const parent = path.findParent(currentNode => {
                        if (currentNode.type !== 'CallExpression') {
                            return false;
                        }
                        return currentNode.get('callee').node.property?.name === 'createClass';
                    })
                    if (parent) {
                        remove(path);
                    };
                }
            },
            AssignmentExpression(path) {
                if (!isProptypesRemove(path)) return;
                const { node, scope } = path;
                if (node.left.computed || !node.left.property || node.left.property.name !== 'propTypes') {
                    return;
                }
                const className: string = node.left.object.name;
                const binding = scope.getBinding(className);
                if (!binding) return;
                if (binding.path.isClassDeclaration()) {
                    const superClass = binding.path.get('superClass');
                    if (isReactClass(superClass, scope)) {
                        remove(path);
                    }
                } else if (isStatelessComponent(binding.path)) {
                    remove(path);
                }
            },
            VariableDeclarator(path) {
                if (!globalOptions.styles.remove || isIgnore(path.scope, globalOptions.styles.ignoreFilenames as RegExp)) return;
                const { node, scope } = path;
                if (node.init?.callee?.object?.name === STYLE_NAME_SPACE && node.init?.callee?.property?.name === STYLE_CREATE_METHOD) {
                    const source = path.scope.getBinding(STYLE_NAME_SPACE)?.path?.parentPath?.get('source');
                    if ((source?.node as StringLiteral)?.value !== 'react-native') return;
                    const stylesIdentifier: string = node.id?.name;
                    const binding = scope.getBinding(stylesIdentifier);
                    let hasSkipCollect: boolean = false;
                    const stylesCollect: Set<string> = new Set();
                    binding?.referencePaths?.forEach(item => {
                        if (item.container?.property) {
                            const propertyKey: string = `${stylesIdentifier} ${item.container.property.name}`;
                            stylesCollect.add(propertyKey);
                        } else {
                            hasSkipCollect = true;
                        }
                    })
                    if (!hasSkipCollect) {
                        path.traverse(collectNestedObjects, {
                            identifier: stylesIdentifier,
                            styles: stylesCollect
                        });
                    }
                    stylesCollect.clear();
                }
            }
        },
    }
}