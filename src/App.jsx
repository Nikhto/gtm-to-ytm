import { useState } from "react";
import { useRef } from "react";
import { Buttons } from "./Buttons";
import "./App.css";

function App() {
	const [fileData, setFileData] = useState();
	const [tags, setTags] = useState();
	const [triggers, setTriggers] = useState();

	// Функция получения триггеров
	const formatFilterObjects = (arrayOfObjects) => {
		if (!Array.isArray(arrayOfObjects)) {
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

		return arrayOfObjects
			.map((obj) => {
				const lines = [];

				// CUSTOM_EVENT с customEventFilter
				if (obj.type === "CUSTOM_EVENT" && Array.isArray(obj.customEventFilter)) {
					const [mainFilter, ...restFilters] = obj.customEventFilter;
					const mainParams = Object.fromEntries(mainFilter.parameter.map((p) => [p.key, p.value]));

					// Заголовок — первая строка
					lines.push(
						`${obj.name}\t${obj.type}\t${mainParams.arg0.replace(/\{\{|\}\}/g, "") || ""}\t${mainFilter.type}\t${
							mainParams.arg1 || ""
						}`
					);

					// Остальные customEventFilter строки
					restFilters.forEach((filter) => {
						const params = getParams(filter);
						lines.push(
							`${obj.name}\t${obj.type}\t${params.arg0.replace(/\{\{|\}\}/g, "")}\t${params.type}\t${params.arg1}`
						);
					});

					// Добавим filter (если есть)
					if (Array.isArray(obj.filter)) {
						obj.filter.forEach((filter) => {
							const params = getParams(filter);
							lines.push(
								`${obj.name}\t${obj.type}\t${params.arg0.replace(/\{\{|\}\}/g, "")}\t${params.type}\t${params.arg1}`
							);
						});
					}

					return lines.join("\n");
				}

				// ELEMENT_VISIBILITY
				if (obj.type === "ELEMENT_VISIBILITY") {
					const selectorType = obj.parameter.filter((f) => f.type == "TEMPLATE" && f.key == "selectorType")[0].value;
					const selectorValue =
						(selectorType == "ID" ? "#" : "") +
						obj.parameter.filter((f) => f.type == "TEMPLATE" && f.key.match(/^element/))[0].value;
					const onScreenRatio = obj.parameter.filter((f) => f.type == "TEMPLATE" && f.key == "onScreenRatio")[0].value;

					// Заголовок и селектор — первая строка
					lines.push(`${obj.name}\t${obj.type}\t{{EV Target}}\t{{CSS_SELECTOR}}\t${selectorValue || ""}`);

					// Процент показа — вторая строка
					lines.push(`${obj.name}\t${obj.type}\t{{onScreenRatio}}\t\t${onScreenRatio || ""}`);

					// Если есть filter
					if (Array.isArray(obj.filter)) {
						obj.filter.forEach((filter) => {
							const p = getParams(filter);
							lines.push(`${obj.name}\t${obj.type}\t${p.arg0}\t${p.type}\t${p.arg1}`);
						});
					}

					return lines.join("\n");
				}

				// Стандартный CLICK или другой тип с filter
				if (Array.isArray(obj.filter)) {
					const [first, ...rest] = obj.filter;
					const firstParams = getParams(first);

					lines.push(`${obj.name}\t${obj.type}\t${firstParams.arg0}\t${firstParams.type}\t${firstParams.arg1}`);

					rest.forEach((filter) => {
						const p = getParams(filter);
						lines.push(`${obj.name}\t${obj.type}\t${p.arg0}\t${p.type}\t${p.arg1}`);
					});

					return lines.join("\n");
				}

				// Если не удалось определить структуру
				return `${obj.name}\t${obj.type}\t[Unsupported format]`;
			})
			.join("\n");
	};

	// Функция для извлечения параметра по ключу
	const getParamValue = (tag, key) => {
		const param = tag.parameter?.find((p) => p.key === key);
		return param ? param.value : "";
	};
	const getTagsAndTriggers = (GTMObj) => {
		// Получаем массив тегов и триггеров
		const tags = GTMObj.containerVersion.tag;
		const triggers = GTMObj.containerVersion.trigger;

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

		let tagsResult = "";
		let triggersResult = formatFilterObjects(triggers);

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

			// Склеиваем строку
			const row = `${name.replaceAll('"', '""')}\t"${htmlCode.replaceAll('"', '""')}"\t"${triggerNames.replaceAll(
				'"',
				'""'
			)}"\t${type}\t${paused}`;
			tagsResult += row + "\n";
		});

		return [tagsResult, triggersResult.trim()];
	};

	const tagsRef = useRef();
	const triggersRef = useRef();

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
		let tagsAndTriggers = getTagsAndTriggers(fileData);
		setTags(tagsAndTriggers[0]);
		setTriggers(tagsAndTriggers[1]);
	};
	return (
		<>
			<div className="container">
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
			<div className="flex-container">
				<div className="textContainer">
					<h3>Теги</h3>
					<textarea
						ref={tagsRef}
						name="tags-text"
						id="tags-text"
						value={tags}
						rows="50"
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
						value={triggers}
						rows="50"
						disabled
					/>
					<Buttons targetRef={triggersRef} />
				</div>
			</div>
		</>
	);
}

export default App;
