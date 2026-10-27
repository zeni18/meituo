<template>
    <button class="pc-close-button" type="button">
        <i class="pc-close-button__icon" aria-hidden="true">
            <span></span>
            <span></span>
        </i>
    </button>
</template>

<style lang="scss" scoped>
.pc-close-button {
    width: 36px !important;
    height: 36px !important;
    min-width: 36px !important;
    min-height: 36px !important;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 10px !important;
    background: transparent !important;
    color: #fff !important;
    font-size: 0 !important;
    line-height: 1 !important;
    cursor: pointer;
    transition: background 0.18s ease;
}

.pc-close-button:hover {
    background: #25262b !important;
}

.pc-close-button__icon {
    position: relative;
    width: 17px;
    height: 17px;
    pointer-events: none;
}

.pc-close-button__icon span {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 17px;
    height: 2.5px;
    border-radius: 999px;
    background: currentColor;
    transform-origin: center;
    pointer-events: none;
}

.pc-close-button__icon span:first-child {
    transform: translate(-50%, -50%) rotate(45deg);
}

.pc-close-button__icon span:last-child {
    transform: translate(-50%, -50%) rotate(-45deg);
}
</style>
