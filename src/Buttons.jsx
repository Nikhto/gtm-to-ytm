import React from "react";
// import CopyIcon from "./assets/copy-icon.svg?react";

import "./Buttons.css";

export const Buttons = ({ targetRef, setTargetState }) => {
	const onCopyClick = () => {
		if (targetRef.current) {
			navigator.clipboard.writeText(targetRef.current.value);
		}
	};

	return (
		<div className="btn-container">
			<button
				className="btn"
				onClick={onCopyClick}>
				<span></span>
			</button>
		</div>
	);
};
