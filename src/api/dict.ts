import request from "@/utils/request/req";

export interface DictData {
	dictCode: number;
	dictSort: number;
	dictLabel: string;
	dictValue: string;
	dictType: string;
	cssClass?: string;
	listClass?: string;
	isDefault?: string;
	status: string;
	remark?: string;
}

export function getDictDataByType(dictType: string) {
	return request({
		url: `/system/dict/data/type/${dictType}`,
		method: "get",
	});
}
