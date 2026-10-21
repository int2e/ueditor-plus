import {EditorView, basicSetup} from 'codemirror';
import {EditorState, Compartment} from '@codemirror/state';
import {keymap} from '@codemirror/view';
import {indentWithTab} from '@codemirror/commands';
import {html} from '@codemirror/lang-html';

// Keep the source plugin independent of CodeMirror's state API.
export function create(holder, options = {}) {
    const readOnly = new Compartment();
    const editable = value => [EditorState.readOnly.of(!!value), EditorView.editable.of(!value)];
    const view = new EditorView({
        parent: holder,
        doc: options.value || '',
        extensions: [
            basicSetup,
            html(),
            keymap.of([indentWithTab]),
            EditorView.lineWrapping,
            readOnly.of(editable(options.readOnly)),
            EditorView.contentAttributes.of({'aria-label': options.label || 'HTML source'}),
            EditorView.theme({
                '&': {position: 'absolute', inset: '0', height: '100%', fontSize: '14px'},
                '.cm-scroller': {overflow: 'auto', fontFamily: 'Consolas, monospace', height: '100%'},
                '.cm-content': {minHeight: '100%'},
                '.cm-tooltip': {zIndex: '10000'}
            }),
            EditorView.updateListener.of(update => {
                if (update.docChanged && options.onChange) options.onChange();
            })
        ]
    });
    view.dom.classList.add('ue-source-editor');
    return {
        view,
        getValue: () => view.state.doc.toString(),
        setValue(value) {
            view.dispatch({changes: {from: 0, to: view.state.doc.length, insert: value}});
        },
        focus: () => view.focus(),
        blur: () => view.contentDOM.blur(),
        refresh: () => view.requestMeasure(),
        getWrapperElement: () => view.dom,
        getScrollerElement: () => view.scrollDOM,
        setOption(name, value) {
            if (name === 'readOnly') view.dispatch({effects: readOnly.reconfigure(editable(value))});
        },
        destroy: () => view.destroy()
    };
}
