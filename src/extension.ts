// Import VSCode API
import * as vscode from 'vscode';
import axios from 'axios';

let timeout: NodeJS.Timeout | null = null;

// This function should be implemented by you to return AI-based completions
async function askAI(prompt: string): Promise<string> {
	//     const llmprompt = `Complete the following code snippet. Only return the direct continuation of the code without any explanations, comments, or additional context. The code should be a natural continuation from this point:

	// ${prompt}

	// Important:
	// - Continue the code exactly from where it left off
	// - Maintain the same coding style and indentation
	// - Only provide the code completion itself
	// - Do not include any explanations or markdown
	// - Do not repeat any part of the input code
	// - Do not include any language tags or code block markers`;

	const llmprompt = `Continue the following code snippet exactly where it left off and return the remaining generated snippet only, maintaining the same style and indentation. Only return the code, without any explanations or markdown:

${prompt}`;


	console.log("Calling AI with prompt: " + llmprompt);

	try {
		const response = await axios.post('http://localhost:11434/api/generate', {
			"model": "qwen2.5-coder:1.5b",
			"prompt": llmprompt,
			"stream": false,
		});

		if (response.data && response.data.response) {
			let aiResponse = response.data.response;
			console.log("Raw AI Response:", aiResponse);

			// Extract code between backticks
			const codeBlockMatch = aiResponse.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
			if (codeBlockMatch && codeBlockMatch[1]) {
				const extractedCode = codeBlockMatch[1].trim();
				console.log("Extracted code:", extractedCode);
				return extractedCode;
			}

			// If no code blocks found, return the raw response
			// This handles cases where the model directly returns code without backticks
			return aiResponse.trim();
		}

		console.warn("Invalid AI response format:", response.data);
		return "";
	} catch (error) {
		console.error("AI request failed:", error);
		return "";
	}
}
// Activate extension
function activate(context: vscode.ExtensionContext) {
	let inlineCompletionProvider = {
		//@ts-ignore
		async provideInlineCompletionItems(document: vscode.TextDocument, position: vscode.Position, completionContext: vscode.InlineCompletionContext, token: vscode.CancellationToken): Promise<vscode.InlineCompletionItem[]> {
			// Get the current line text up to the cursor position
			const lineText = document.lineAt(position).text.substring(0, position.character);
			if (!lineText.trim()) { return []; }

			console.log("User is typing...");

			return new Promise(resolve => {
				if (timeout) {
					clearTimeout(timeout);
				}

				timeout = setTimeout(async () => {
					console.log("Sending request after typing delay: " + lineText);
					try {
						const suggestion = await askAI(lineText);

						if (!suggestion.trim()) {
							resolve([]);
							return;
						}

						// Create a range from current position
						const range = new vscode.Range(position, position);

						// Create completion items with different indentation levels
						const completionItems = [];

						// Original suggestion
						completionItems.push(new vscode.InlineCompletionItem(suggestion, range));

						// Try with additional indentation if in a code block
						const currentIndentation = lineText.match(/^\s*/)?.[0] || '';
						if (currentIndentation) {
							// Add suggestion with matching indentation
							const indentedLines = suggestion
								.split('\n')
								.map(line => line ? currentIndentation + line : line)
								.join('\n');

							completionItems.push(new vscode.InlineCompletionItem(indentedLines, range));
						}

						resolve(completionItems);
					} catch (error) {
						console.error("Error creating completion items:", error);
						resolve([]);
					}
				}, 2000); // Delay API request by 500ms after user stops typing
			});
		}
	};


	// Register command to accept completion
	let acceptCompletionCommand = vscode.commands.registerCommand('acceptCompletion', async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor && provider) {
			const position = editor.selection.active;
			const completions = inlineCompletionProvider.provideInlineCompletionItems(
				editor.document,
				position,
				{} as any,
				{} as any
			);

			if (await completions) {
				vscode.commands.executeCommand('editor.action.inlineSuggest.commit');
			}
		}
	});

	let provider = vscode.languages.registerInlineCompletionItemProvider('*', inlineCompletionProvider);
	context.subscriptions.push(provider, acceptCompletionCommand);
}

// Deactivate extension
function deactivate() { }

module.exports = { activate, deactivate };
