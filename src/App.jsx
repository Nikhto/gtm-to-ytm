import { useState } from "react";
import { useRef } from "react";
import { Buttons } from "./Buttons";
import axios from "axios";
import "./App.css";

function App() {
	const [fileData, setFileData] = useState();
	const [isDataParsed, setIsDataParsed] = useState(false);
	const [tags, setTags] = useState([]);
	const [triggers, setTriggers] = useState([]);
	const [variables, setVariables] = useState([]);
	const [projectName, setProjectName] = useState();

	// Функция получения триггеров
	const getTriggers = (triggers) => {
		if (!Array.isArray(triggers)) {
			throw new Error("Input must be an array of objects");
		}

		const getParams = (filter) => {
			const params = Object.fromEntries(filter.parameter.map((p) => [p.key, p.value]));
			const negate = filter.parameter.some((p) => p.key === "negate" && p.value === "true");
			return {
				arg0: params.arg0.replace(/\{\{|\}\}/g, "") || "",
				arg1: params.arg1 || "",
				type: `${negate ? "not " : ""}${filter.type}`,
			};
		};

		return triggers.map((obj) => {
			const lines = [];

			// CUSTOM_EVENT с customEventFilter
			if (obj.type === "CUSTOM_EVENT" && Array.isArray(obj.customEventFilter)) {
				const [mainFilter, ...restFilters] = obj.customEventFilter;
				const mainParams = Object.fromEntries(mainFilter.parameter.map((p) => [p.key, p.value]));

				// Заголовок — первая строка
				lines.push([
					obj.name,
					obj.type,
					mainParams.arg0.replace(/\{\{|\}\}/g, "") || "",
					mainFilter.type,
					mainParams.arg1 || "",
				]);

				// Остальные customEventFilter строки
				restFilters.forEach((filter) => {
					const params = getParams(filter);
					lines.push([obj.name, obj.type, params.arg0.replace(/\{\{|\}\}/g, ""), params.type, params.arg1]);
				});

				// Добавим filter (если есть)
				if (Array.isArray(obj.filter)) {
					obj.filter.forEach((filter) => {
						const params = getParams(filter);
						lines.push([obj.name, obj.type, params.arg0.replace(/\{\{|\}\}/g, ""), params.type, params.arg1]);
					});
				}

				return lines;
			}

			// ELEMENT_VISIBILITY
			if (obj.type === "ELEMENT_VISIBILITY") {
				const selectorType = obj.parameter.filter((f) => f.type == "TEMPLATE" && f.key == "selectorType")[0].value;
				const selectorValue =
					(selectorType == "ID" ? "#" : "") +
					obj.parameter.filter((f) => f.type == "TEMPLATE" && f.key.match(/^element/))[0].value;
				const onScreenRatio = obj.parameter.filter((f) => f.type == "TEMPLATE" && f.key == "onScreenRatio")[0].value;

				// Заголовок и селектор — первая строка
				lines.push([obj.name, obj.type, "EV Target", "CSS_SELECTOR", selectorValue || ""]);

				// Процент показа — вторая строка
				lines.push([obj.name, obj.type, "onScreenRatio", "", onScreenRatio || ""]);

				// Если есть filter
				if (Array.isArray(obj.filter)) {
					obj.filter.forEach((filter) => {
						const p = getParams(filter);
						lines.push([obj.name, obj.type, p.arg0, p.type, p.arg1]);
					});
				}

				return lines;
			}

			// TRIGGER GROUP
			if (obj.type === "TRIGGER_GROUP") {
				console.log(obj);
				let refs = triggers
					.filter((trigger) =>
						obj.parameter
							.filter((p) => p.key == "triggerIds")[0]
							.list.map((ref) => ref.value)
							.includes(trigger.triggerId)
					)
					.map((tr) => tr.name);
				console.log(refs);
				refs.forEach((ref) => lines.push([obj.name, obj.type, "Триггер", "", ref]));
				if (Array.isArray(obj.filter)) {
					const [first, ...rest] = obj.filter;
					const firstParams = getParams(first);

					lines.push([obj.name, obj.type, firstParams.arg0, firstParams.type, firstParams.arg1]);

					rest.forEach((filter) => {
						const p = getParams(filter);
						lines.push([obj.name, obj.type, p.arg0, p.type, p.arg1]);
					});
				}
				return lines;
			}

			// Стандартный CLICK или другой тип с filter
			if (Array.isArray(obj.filter)) {
				const [first, ...rest] = obj.filter;
				const firstParams = getParams(first);

				lines.push([obj.name, obj.type, firstParams.arg0, firstParams.type, firstParams.arg1]);

				rest.forEach((filter) => {
					const p = getParams(filter);
					lines.push([obj.name, obj.type, p.arg0, p.type, p.arg1]);
				});

				return lines;
			} else {
				lines.push([obj.name, obj.type, "Все события"]);
				return lines;
			}
		});
	};

	// Функция получения переменных
	const variablesToTable = (variables) => {
		// Создаем таблицу
		const table = [];

		// Обрабатываем каждую переменную
		variables.forEach((variable) => {
			let type = "";
			let value = "";

			// Определяем тип переменной и извлекаем значение
			switch (variable.type) {
				case "v": // Data Layer Variable
					type = "Переменная уровня данных";
					value = variable.parameter.find((p) => p.key === "name")?.value || "";
					break;

				case "jsm": // JavaScript Variable
					type = "Код JS";
					value = variable.parameter.find((p) => p.key === "javascript")?.value || "";
					// Форматируем для лучшей читаемости
					value = value.replace(/\\n/g, "\n").replace(/\\"/g, '"');
					break;

				case "c": // Constant Variable
					type = "Константа";
					value = variable.parameter.find((p) => p.key === "value")?.value || "";
					break;

				default:
					type = variable.type;
					value = JSON.stringify(variable.parameter);
			}

			// Добавляем строку в таблицу
			table.push([variable.name, type, value]);
		});

		return table;
	};

	// Функция для извлечения параметра по ключу
	const getParamValue = (tag, key) => {
		const param = tag.parameter?.find((p) => p.key === key);
		return param ? param.value : "";
	};
	const getContainerData = (GTMObj) => {
		// Получаем массив тегов и триггеров
		const tags = GTMObj.containerVersion.tag;
		const triggers = GTMObj.containerVersion.trigger;
		const variables = GTMObj.containerVersion.variable;

		// Создаём словарь для быстрого поиска названий триггеров по ID
		const triggerMap = {};
		triggers.forEach((trigger) => {
			triggerMap[trigger.triggerId] = trigger.name;
		});
		triggerMap[2147479553] = "All Pages";
		triggerMap[2147479572] = "Consent Initialization - All Pages";
		triggerMap[2147479573] = "Initialization - All Pages";

		// Заголовки
		// Название тега\tТип тега\tТриггеры\tHTML-код\tНа паузе

		let tagsResult = [];
		let triggersResult = getTriggers(triggers);
		let variablesResult = variablesToTable(variables);

		// Формируем строки
		tags.forEach((tag) => {
			const name = tag.name || "";
			const type = tag.type || "";

			const triggerNames = (tag.firingTriggerId || [])
				.map((id) => triggerMap[id])
				.filter(Boolean)
				.join("\n");

			const htmlCode = tag.type === "html" ? getParamValue(tag, "html") : "";

			const paused = tag.paused === true ? "TRUE" : "FALSE";

			const row = [name.replaceAll('"', '""'), htmlCode, triggerNames, type, paused];
			tagsResult.push(row);
		});

		return [tagsResult, triggersResult, variablesResult];
	};

	const tagsRef = useRef();
	const triggersRef = useRef();
	const sheetURLRef = useRef();

	const scanFile = (event) => {
		const file = event.target.files[0];
		const reader = new FileReader();
		reader.readAsText(file);
		reader.onload = () => {
			setFileData(JSON.parse(reader.result));
		};
		reader.onerror = () => {
			console.log(reader.error);
		};
	};

	const printFileData = () => {
		let containerData = getContainerData(fileData);
		setIsDataParsed(true);
		setTags(containerData[0]);
		setTriggers(containerData[1].flat());
		setVariables(containerData[2]);
	};

	const projectInputChange = (e) => {
		setProjectName(e.target.value);
	};
	const googleAppsPost = () => {
		sheetURLRef.current.innerHTML = `<div class="loader"></div>`;
		axios
			.post(
				"https://script.google.com/macros/s/AKfycbxWXaQ9TwYwSs5Ut_Uluwfkg4gezjyCRFs3PZU-zsVoRv0SPrSRYd9bv7i5NG4sDTKQ/exec",
				JSON.stringify({
					tags: tags,
					triggers: triggers,
					variables: variables,
					project: projectName || "без названия",
				}),
				{
					headers: {
						"Content-Type": "text/plain;charset=utf-8",
					},
				}
			)
			.then((response) => {
				if (response.status == "200" && response.data.url) {
					sheetURLRef.current.innerHTML = `<a href="${response.data.url}">${response.data.url}</a>`;
				}
			})
			.catch((error) => {
				console.log(error);
			});
	};
	return (
		<>
			<div className="container">
				<div className="flex-container flex-center">
					<input
						type="file"
						onChange={scanFile}
					/>
					<button
						id="printBtn"
						onClick={printFileData}>
						Вывести теги и триггеры
					</button>
				</div>
			</div>
			<div className="container">
				<div className="flex-container flex-center">
			<input
				type="text"
				placeholder="Проект"
				onChange={projectInputChange}
			/>
			<button
				id="g-apps-post-btn"
				onClick={googleAppsPost}
				disabled={!isDataParsed}
				>
				Сгенерировать таблицу
			</button>
			
				</div>
			</div>
			<div ref={sheetURLRef}></div>
			<div className="flex-container">
				<div className="textContainer">
					<h3>Теги</h3>
					<textarea
						ref={tagsRef}
						name="tags-text"
						id="tags-text"
						value={tags.map((i) => i.map((j) => `"${j.replaceAll('"', '""')}"`).join("\t")).join("\n")}
						rows="40"
						disabled
					/>
					<Buttons targetRef={tagsRef} />
				</div>
				<div className="textContainer">
					<h3>Триггеры</h3>
					<textarea
						ref={triggersRef}
						name="triggers-text"
						id="triggers-text"
						value={triggers.map((i) => i.join("\t")).join("\n")}
						rows="40"
						disabled
					/>
					<Buttons targetRef={triggersRef} />
				</div>
			</div>
		</>
	);
}

export default App;
